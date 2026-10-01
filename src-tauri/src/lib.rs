//全てのTauriコマンド（ファイル検索、OS連携など）が書かれたメイン処理。（今後は少しずつ分割する）

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

// モジュールを登録
pub mod models;
pub mod search_ops;
pub mod file_ops;
pub mod task_ops;
mod dashboard_ops;

pub use models::*;
use std::fs;
use tauri::Manager;

#[tauri::command]
async fn extract_files_by_tag(
    dir_path: String,
    target_tag: String,
    include_inline: bool,
) -> Result<Vec<String>, String> {
    let mut matched_files = Vec::new();
    let entries = fs::read_dir(dir_path).map_err(|e| e.to_string())?;

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("md") {
            if let Ok(content) = fs::read_to_string(&path) {
                let is_match = if include_inline {
                    content.contains(&format!("#{}", target_tag))
                        || check_frontmatter(&content, &target_tag)
                } else {
                    check_frontmatter(&content, &target_tag)
                };

                if is_match {
                    matched_files.push(path.to_string_lossy().into_owned());
                }
            }
        }
    }
    Ok(matched_files)
}

fn check_frontmatter(content: &str, tag: &str) -> bool {
    if content.starts_with("---\n") {
        if let Some(end_idx) = content[4..].find("---\n") {
            let frontmatter = &content[4..4 + end_idx];
            return frontmatter.contains(tag);
        }
    }
    false
}


// ファイルのメタ情報を扱う構造体
#[derive(Debug, Clone)]
struct FileMeta {
    path: String,
    name: String,
    created: std::time::SystemTime,
    modified: std::time::SystemTime,
    content: String,
}

// フォルダを再帰的に走査して FileMeta を集める関数
fn collect_files(dir: &std::path::Path, metas: &mut Vec<FileMeta>) {
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                collect_files(&path, metas);
            } else if path.is_file() {
                if let Some(ext) = path.extension().and_then(|s| s.to_str()) {
                    if ext == "md" || ext == "txt" {
                        let name = path.file_name().unwrap_or_default().to_string_lossy().into_owned();
                        let metadata = entry.metadata().unwrap();
                        let modified = metadata.modified().unwrap_or(std::time::SystemTime::UNIX_EPOCH);
                        let created = metadata.created().unwrap_or(modified);
                        let content = fs::read_to_string(&path).unwrap_or_default();
                        
                        metas.push(FileMeta {
                            path: path.to_string_lossy().into_owned(),
                            name, created, modified, content,
                        });
                    }
                }
            }
        }
    }
}

// パスのリストからツリー構造を復元する関数
fn build_tree_from_paths(files: Vec<FileMeta>, base_dir: &str) -> Vec<VirtualNode> {
    use std::collections::HashMap;
    // created と modified を追加
    struct TempNode { is_file: bool, name: String, path: String, created: u64, modified: u64, children: HashMap<String, TempNode> }

    let mut root = TempNode { is_file: false, name: "".into(), path: base_dir.into(), created: 0, modified: 0, children: HashMap::new() };
    let base_path = std::path::Path::new(base_dir);

    for file in files {
        if let Ok(rel_path) = std::path::Path::new(&file.path).strip_prefix(base_path) {
            let components: Vec<_> = rel_path.components().map(|c| c.as_os_str().to_string_lossy().into_owned()).collect();
            let mut current = &mut root;
            let mut current_path = base_path.to_path_buf();

            // 日付をミリ秒(u64)に変換
            let c_ms = file.created.duration_since(std::time::SystemTime::UNIX_EPOCH).unwrap_or_default().as_millis() as u64;
            let m_ms = file.modified.duration_since(std::time::SystemTime::UNIX_EPOCH).unwrap_or_default().as_millis() as u64;

            for (i, comp) in components.iter().enumerate() {
                current_path.push(comp);
                if i == components.len() - 1 {
                    current.children.insert(comp.clone(), TempNode { is_file: true, name: comp.clone(), path: file.path.clone(), created: c_ms, modified: m_ms, children: HashMap::new() });
                } else {
                    let cp = current_path.to_string_lossy().into_owned();
                    current = current.children.entry(comp.clone()).or_insert_with(|| TempNode { is_file: false, name: comp.clone(), path: cp, created: 0, modified: 0, children: HashMap::new() });
                }
            }
        }
    }

    fn convert(temp: TempNode) -> Vec<VirtualNode> {
        let mut nodes = Vec::new();
        let mut vals: Vec<_> = temp.children.into_values().collect();
        vals.sort_by(|a, b| if a.is_file == b.is_file { a.name.cmp(&b.name) } else if a.is_file { std::cmp::Ordering::Greater } else { std::cmp::Ordering::Less });
        for val in vals {
            if val.is_file { 
                // 💥 変更: created と modified を渡す
                nodes.push(VirtualNode::File { name: val.name, path: val.path, created: val.created, modified: val.modified, category: None });
            } else { 
                let name_clone = val.name.clone();
                let path_clone = val.path.clone();
                nodes.push(VirtualNode::Folder {
                    name: name_clone, 
                    original_path: Some(path_clone), 
                    children: convert(val), 
                    smart_rules: None,
                    sort_by: None,    
                    sort_order: None,  
                    category: None
                }); 
            }
        }
        nodes
    }
    convert(root)
}

/// 複数のファイルパスから共通の祖先ディレクトリを計算する純粋関数
fn get_common_base_path(files: &[FileMeta]) -> String {
    if files.is_empty() {
        return String::new();
    }
    let mut common_path = std::path::PathBuf::from(&files[0].path);
    common_path.pop(); // ファイル名を除去
    
    for file in files.iter().skip(1) {
        let path = std::path::Path::new(&file.path);
        let mut new_common = std::path::PathBuf::new();
        let mut it1 = common_path.components();
        let mut it2 = path.components();
        while let (Some(c1), Some(c2)) = (it1.next(), it2.next()) {
            if c1 == c2 {
                new_common.push(c1);
            } else {
                break;
            }
        }
        common_path = new_common;
    }
    common_path.to_string_lossy().into_owned()
}

// スマートフォルダの条件評価コマンド
#[tauri::command]
async fn evaluate_smart_folder(
    rules: SmartRules, 
    workspace_nodes: Option<Vec<VirtualNode>> // 💥 フロントの最新ツリーを受け取る
) -> Result<Vec<VirtualNode>, String> {
    
    let mut all_files = Vec::new();

    // 1. 抽出元フォルダが指定されている場合
    if !rules.target_dir.trim().is_empty() {
        collect_files(std::path::Path::new(&rules.target_dir), &mut all_files);
    }

    // 2. ワークスペースが抽出対象にチェックされている場合
    if rules.target_workspace {
        if let Some(nodes) = workspace_nodes {
            
            // 💥 変更: OSの物理フォルダを読み直すのではなく、ツリー上に見えているファイルだけを純粋にかき集める
            fn traverse(nodes: &[VirtualNode], files: &mut Vec<FileMeta>) {
                for node in nodes {
                    match node {
                        VirtualNode::Folder { children, .. } => {
                            traverse(children, files);
                        },
                        VirtualNode::File { path, .. } => {
                            if let Some(meta) = get_file_meta_from_path(std::path::Path::new(path)) {
                                files.push(meta);
                            }
                        }
                    }
                }
            }
            
            traverse(&nodes, &mut all_files);
        }
    }

    // 指定フォルダとワークスペースの範囲が被っていた場合、ファイルの重複を排除する
    all_files.sort_by(|a, b| a.path.cmp(&b.path));
    all_files.dedup_by(|a, b| a.path == b.path);

    // Date条件のインデックスズレを防ぐため、条件の絶対インデックスをキーにしたHashMapで管理
    let mut date_sets: std::collections::HashMap<usize, std::collections::HashSet<String>> = std::collections::HashMap::new();
    for (i, cond) in rules.conditions.iter().enumerate() {
        if let SmartCondition::Date { date_type, limit } = cond {
            let mut sorted = all_files.clone();
            if date_type == "created" { sorted.sort_by(|a, b| b.created.cmp(&a.created)); } 
            else { sorted.sort_by(|a, b| b.modified.cmp(&a.modified)); }
            date_sets.insert(i, sorted.into_iter().take(*limit).map(|f| f.path).collect());
        }
    }

    let mut filtered_files = Vec::new();
    for file in all_files {
        let mut is_match_all = true;
        let mut is_match_any = false;
        let mut has_conditions = false;

        // enumerate を使って絶対インデックス(i)を取得
        for (i, cond) in rules.conditions.iter().enumerate() {
            has_conditions = true;
            let cond_match = match cond {
                SmartCondition::Tag { tag, match_mode, include_inline, is_exclude } => {
                    let has_tag = check_tag_match(&file.content, tag, match_mode, *include_inline);
                    if *is_exclude { !has_tag } else { has_tag }
                },
                SmartCondition::Date { .. } => {
                    // HashMapから安全に取得。存在しない場合はマッチしないとみなす
                    date_sets.get(&i).map_or(false, |set| set.contains(&file.path))
                }
            };
            is_match_all = is_match_all && cond_match;
            is_match_any = is_match_any || cond_match;
        }

        let is_valid = if !has_conditions { true } else if rules.match_type == "AND" { is_match_all } else { is_match_any };
        if is_valid { filtered_files.push(file); }
    }

    if rules.keep_structure { 
    // ワークスペース抽出時など target_dir が空の場合、抽出されたファイル群から共通の祖先パスを算出する
        let base = if !rules.target_dir.trim().is_empty() { 
            rules.target_dir.clone() 
        } else { 
            get_common_base_path(&filtered_files) 
        };
        Ok(build_tree_from_paths(filtered_files, &base)) 
    } else { 
        Ok(filtered_files.into_iter().map(|f| {
            let c_ms = f.created.duration_since(std::time::SystemTime::UNIX_EPOCH).unwrap_or_default().as_millis() as u64;
            let m_ms = f.modified.duration_since(std::time::SystemTime::UNIX_EPOCH).unwrap_or_default().as_millis() as u64;
            VirtualNode::File { name: f.name, path: f.path, created: c_ms, modified: m_ms, category: None }
        }).collect()) 
    }
}

// 単体のファイルパスからデータを構築する関数
fn get_file_meta_from_path(path: &std::path::Path) -> Option<FileMeta> {
    if path.is_file() {
        if let Some(ext) = path.extension().and_then(|s| s.to_str()) {
            if ext == "md" || ext == "txt" {
                if let Ok(metadata) = std::fs::metadata(path) {
                    let name = path.file_name().unwrap_or_default().to_string_lossy().into_owned();
                    let modified = metadata.modified().unwrap_or(std::time::SystemTime::UNIX_EPOCH);
                    let created = metadata.created().unwrap_or(modified);
                    let content = std::fs::read_to_string(path).unwrap_or_default();
                    return Some(FileMeta {
                        path: path.to_string_lossy().into_owned(),
                        name, created, modified, content,
                    });
                }
            }
        }
    }
    None
}

// タグを正確に抽出し、指定された条件で比較する関数
fn check_tag_match(content: &str, target_tag: &str, match_mode: &str, include_inline: bool) -> bool {
    let target = target_tag.trim();
    if target.is_empty() {
        return false; // 空文字の場合はマッチさせない（全件ヒットバグの防止）
    }

    let mut candidate_tags = Vec::new();

    // 1. フロントマター内から「単語」だけを抽出する
    if content.starts_with("---\n") {
        if let Some(end_idx) = content[4..].find("---\n") {
            let frontmatter = &content[4..4 + end_idx];
            let delimiters = [' ', '\n', '\t', ',', '[', ']', '"', '\'', '-'];
            for word in frontmatter.split(|c: char| delimiters.contains(&c)) {
                let w = word.trim();
                if !w.is_empty() && w != "tags:" && w != "tag:" {
                    candidate_tags.push(w);
                }
            }
        }
    }

    // 2. 本文中から "#" で始まる単語を抽出する
    if include_inline {
        let delimiters = [' ', '\n', '\t', ',', '.', '!', '?', '(', ')', '[', ']', '<', '>'];
        for word in content.split(|c: char| delimiters.contains(&c)) {
            if word.starts_with('#') && word.len() > 1 {
                candidate_tags.push(&word[1..]); // 先頭の # を除いて格納
            }
        }
    }

    // 3. 抽出したタグの中に条件を満たすものがあるかチェック
    for tag in candidate_tags {
        let is_match = match match_mode {
            "exact" => tag == target,
            "starts" => tag.starts_with(target),
            "ends" => tag.ends_with(target),
            "contains" => tag.contains(target),
            _ => tag.contains(target),
        };
        if is_match {
            return true;
        }
    }
    false
}


#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .plugin(tauri_plugin_window_state::Builder::default().build()) 
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            extract_files_by_tag,
            evaluate_smart_folder,
            search_ops::search_files,

            open_launcher,      
            show_main_window,   

            file_ops::save_workspaces,
            file_ops::load_workspaces,
            file_ops::get_file_modified,
            file_ops::read_file_content,
            file_ops::read_directory,
            file_ops::save_file_content,
            file_ops::create_new_file,
            file_ops::open_folder,
            file_ops::find_image_file,
            file_ops::check_file_exists,
            file_ops::read_image_bytes,
            task_ops::get_workspace_tasks,
            task_ops::complete_task,
            search_ops::get_workspace_tags,
            dashboard_ops::load_dashboard,
            dashboard_ops::save_dashboard
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// ランチャーウィンドウを開くコマンド
#[tauri::command]
async fn open_launcher(app: tauri::AppHandle) -> Result<(), String> {
    // 既に開いていれば前面に出すだけ
    if let Some(window) = app.get_webview_window("launcher") {
        let _ = window.show();
        let _ = window.set_focus();
        return Ok(());
    }

    // 新しいウィンドウを作成
    tauri::WebviewWindowBuilder::new(
        &app,
        "launcher",
        tauri::WebviewUrl::App("/?launcher=true".into()),
    )
    .title("ワークスペース一覧")
    .inner_size(400.0, 500.0)
    .resizable(false)
    .build()
    .map_err(|e| e.to_string())?;

    Ok(())
}

// メインウィンドウを表示するコマンド
#[tauri::command]
async fn show_main_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
    Ok(())
}
