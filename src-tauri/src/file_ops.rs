//ファイル保存、読み込み関係。

use std::fs;
use std::io::Write;
use tauri::{AppHandle, Manager};
// lib.rs で定義されている構造体を使えるように読み込む
use crate::{Workspace, VirtualNode};

use std::path::Path;

/// フォルダ内のクラッシュ時の未処理ファイルを安全に復旧または破棄する
fn recover_temp_files(dir: &Path) {
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let file_name = entry.file_name();
            let name_str = file_name.to_string_lossy();
            
            if name_str.starts_with(".~backup_") {
                // インプレース上書き中にクラッシュした場合は、安全なバックアップから復旧
                let original_name = name_str.trim_start_matches(".~backup_");
                let original_path = dir.join(original_name);
                let backup_path = entry.path();
                
                // バックアップで元ファイルを上書き復旧（renameは一瞬で終わるため安全）
                let _ = fs::rename(&backup_path, &original_path);
            } else if name_str.starts_with(".~writing_") || name_str.starts_with(".~ready_") {
                // 以前の古いバージョンのゴミが残っていれば安全のため削除
                let _ = fs::remove_file(entry.path());
            }
        }
    }
}

///  作成日時を確実に維持しつつ、データ消失を防ぐ「安全なインプレース上書き」
pub fn atomic_write(path: &Path, content: &[u8]) -> Result<(), String> {
    let dir = path.parent().unwrap_or_else(|| Path::new(""));
    let file_name = path.file_name().unwrap_or_default().to_string_lossy();

    // 既存ファイルの退避用バックアップパス
    let backup_path = dir.join(format!(".~backup_{}", file_name));

    // 前回のゴミバックアップが残っていれば念のため消す
    let _ = fs::remove_file(&backup_path);

    // 1. 既存ファイルがある場合は、上書き前に「完全なデータ」のバックアップを作る
    if path.exists() {
        if let Err(e) = fs::copy(path, &backup_path) {
            return Err(format!("バックアップの作成に失敗しました: {}", e));
        }
    }

    // 2. 元ファイルの中身をクリア(truncate)して新しいデータを書き込む。
    // この「インプレース上書き」によりOSの作成日時が確実に維持される。
    let write_result = (|| -> std::io::Result<()> {
        let mut file = fs::OpenOptions::new().write(true).create(true).truncate(true).open(path)?;
        file.write_all(content)?;
        file.sync_all()?;
        Ok(())
    })();

    match write_result {
        Ok(_) => {
            // 3. 上書きが完全に成功したらバックアップを消す
            let _ = fs::remove_file(&backup_path);
            Ok(())
        }
        Err(e) => {
            // 💥 万が一上書き中にエラー（強制終了やディスクフル等）が起きたら、退避したバックアップから即座に復旧
            if backup_path.exists() {
                let _ = fs::rename(&backup_path, path);
            }
            Err(format!("ファイルの保存に失敗しました: {}", e))
        }
    }
}

// ============================================
// ファイル・ディレクトリ操作系コマンド
// ============================================

// ファイルの最終更新日時(ミリ秒)を取得するコマンド
#[tauri::command]
pub fn get_file_modified(path: String) -> Result<u64, String> {
    if let Ok(metadata) = fs::metadata(&path) {
        let modified = metadata.modified().unwrap_or(std::time::SystemTime::UNIX_EPOCH)
            .duration_since(std::time::SystemTime::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;
        Ok(modified)
    } else {
        Ok(0)
    }
}

#[tauri::command]
pub fn save_workspaces(app: AppHandle, workspaces: Vec<Workspace>) -> Result<(), String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&app_data_dir).map_err(|e| e.to_string())?;

    let path = app_data_dir.join("workspaces.json");
    let json = serde_json::to_string(&workspaces).map_err(|e| e.to_string())?;
    
    atomic_write(&path, json.as_bytes())
}

#[tauri::command]
pub fn load_workspaces(app: AppHandle) -> Result<Vec<Workspace>, String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let path = app_data_dir.join("workspaces.json");

    if !path.exists() {
        return Ok(Vec::new()); 
    }

    let json = fs::read_to_string(path).map_err(|e| e.to_string())?;
    let workspaces: Vec<Workspace> = serde_json::from_str(&json).map_err(|e| e.to_string())?;
    Ok(workspaces)
}

/// 画像などをバイナリとして読み込む
#[tauri::command]
pub fn read_image_bytes(path: String) -> Result<Vec<u8>, String> {
    std::fs::read(&path).map_err(|e| e.to_string())
}

// 保存時に日時をチェックし、問題なければ新しい日時を返すように修正
#[tauri::command]
pub fn save_file_content(path: String, content: String, last_modified: u64, force: bool) -> Result<u64, String> {
    let path_obj = std::path::Path::new(&path);
    
    // 競合チェック (強制保存でない場合のみ)
    if !force && path_obj.exists() {
        if let Ok(metadata) = fs::metadata(path_obj) {
            let current_mod = metadata.modified().unwrap_or(std::time::SystemTime::UNIX_EPOCH)
                .duration_since(std::time::SystemTime::UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis() as u64;
                
            // OSによるミリ秒の微細なブレを許容するため、2秒(2000ms)以上新しければ競合とみなす
            if last_modified > 0 && current_mod > last_modified + 2000 {
               
                // タイムスタンプに差異がある場合、ディスク上の内容と比較する
                if let Ok(existing_bytes) = fs::read(path_obj) {
                   // 内容が異なっている場合のみ競合エラーとする（同じ内容なら通知なしで上書きOK）
                   if existing_bytes != content.as_bytes() {
                       return Err("CONFLICT".to_string());
                   }
               } else {
                   return Err("CONFLICT".to_string());
               }
           }
         }
     }
            

    // アトミック書き込みを実行
    atomic_write(path_obj, content.as_bytes())?;
    
    // 書き込み完了後の新しい更新日時を取得して返す
    if let Ok(metadata) = fs::metadata(path_obj) {
        let new_mod = metadata.modified().unwrap_or(std::time::SystemTime::UNIX_EPOCH)
            .duration_since(std::time::SystemTime::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;
        Ok(new_mod)
    } else {
        Ok(last_modified) // 取れなかった場合の保険
    }
}

use encoding_rs::{UTF_8, SHIFT_JIS}; 

#[tauri::command]
pub fn read_file_content(path: String) -> Result<String, String> {
    // 読み込む前にリカバリー処理を走らせて安全を確保
    let file_path = Path::new(&path);
    if let Some(dir) = file_path.parent() {
        recover_temp_files(dir);
    }

    let bytes = fs::read(&path).map_err(|e| format!("Failed to read file: {}", e))?;
    
    // 1. まずUTF-8としてデコードを試みる
    let (cow, _encoding_used, had_errors) = UTF_8.decode(&bytes);
    
    if !had_errors {
        // UTF-8で問題なく読めた場合
        Ok(cow.into_owned())
    } else {
        // 2. UTF-8でエラーが出た場合はShift-JISとしてデコードする
        let (cow_sjis, _, _) = SHIFT_JIS.decode(&bytes);
        Ok(cow_sjis.into_owned())
    }
}
#[tauri::command]
pub fn read_directory(
    path: String,
    sort_by: Option<String>,
    sort_order: Option<String>
) -> Result<Vec<VirtualNode>, String> {
        // フォルダを展開する前にリカバリー処理を走らせて安全を確保
    let dir_path = Path::new(&path);
    if dir_path.exists() && dir_path.is_dir() {
        recover_temp_files(dir_path);
    }

    let mut nodes = Vec::new();
    let entries = fs::read_dir(path).map_err(|e| e.to_string())?;

    for entry in entries.flatten() {
        let path = entry.path();
        let name = path.file_name().unwrap_or_default().to_string_lossy().into_owned();

        if path.is_dir() {
            nodes.push(VirtualNode::Folder {
                name,
                original_path: Some(path.to_string_lossy().into_owned()),
                children: Vec::new(), 
                smart_rules: None, 
                sort_by: None,    
                sort_order: None, 
                category: None,
            });
        } else if path.is_file() && (path.extension().and_then(|s| s.to_str()) == Some("md") || path.extension().and_then(|s| s.to_str()) == Some("txt")) {
            let metadata = entry.metadata().unwrap();
            let modified = metadata.modified().unwrap_or(std::time::SystemTime::UNIX_EPOCH).duration_since(std::time::SystemTime::UNIX_EPOCH).unwrap_or_default().as_millis() as u64;
            let created = metadata.created().unwrap_or(metadata.modified().unwrap_or(std::time::SystemTime::UNIX_EPOCH)).duration_since(std::time::SystemTime::UNIX_EPOCH).unwrap_or_default().as_millis() as u64;

            nodes.push(VirtualNode::File {
                name,
                path: path.to_string_lossy().into_owned(),
                created,  
                modified, 
                category: None,
            });
        }
    }

    let by = sort_by.unwrap_or_else(|| "name".to_string());
    let is_asc = sort_order.unwrap_or_else(|| "asc".to_string()) == "asc";

    nodes.sort_by(|a, b| {
        let is_dir_a = matches!(a, VirtualNode::Folder { .. });
        let is_dir_b = matches!(b, VirtualNode::Folder { .. });
                
        // フォルダは常に上に配置する
        if is_dir_a != is_dir_b {
            return is_dir_b.cmp(&is_dir_a);
        }
        
        let cmp_result = match by.as_str() {
            "created" => {
                let t_a = match a { VirtualNode::File { created, .. } => *created, _ => 0 };
                let t_b = match b { VirtualNode::File { created, .. } => *created, _ => 0 };
                t_a.cmp(&t_b)
            },
            "modified" => {
                let t_a = match a { VirtualNode::File { modified, .. } => *modified, _ => 0 };
                let t_b = match b { VirtualNode::File { modified, .. } => *modified, _ => 0 };
                t_a.cmp(&t_b)
            },
            _ => {
                let n_a = match a { VirtualNode::Folder { name, .. } | VirtualNode::File { name, .. } => name };
                let n_b = match b { VirtualNode::Folder { name, .. } | VirtualNode::File { name, .. } => name };
                n_a.to_lowercase().cmp(&n_b.to_lowercase())
            }
        };

        if is_asc { cmp_result } else { cmp_result.reverse() }
    });

    Ok(nodes)
}

#[tauri::command]
pub fn create_new_file(dir_path: String, file_name: String, insert_tag: String) -> Result<(), String> {
    let path = std::path::Path::new(&dir_path).join(&file_name);
    if path.exists() {
        return Err("同じ名前のファイルがすでに存在します".into());
    }
    
    let mut content = String::new();
    if !insert_tag.trim().is_empty() {
        content = format!("---\ntags:\n  - {}\n---\n\n", insert_tag.trim());
    }

    fs::write(path, content).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn open_folder(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer").arg(&path).spawn().map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open").arg(&path).spawn().map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open").arg(&path).spawn().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn find_image_file(dir_path: String, file_name: String) -> Result<Option<String>, String> {
    if dir_path.trim().is_empty() {
        return Ok(None);
    }
    
    fn find_recursive(dir: &std::path::Path, target: &str) -> Option<String> {
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    if let Some(found) = find_recursive(&path, target) {
                        return Some(found);
                    }
                } else if path.is_file() {
                    if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                        if name == target {
                            return Some(path.to_string_lossy().into_owned());
                        }
                    }
                }
            }
        }
        None
    }

    Ok(find_recursive(std::path::Path::new(&dir_path), &file_name))
}

#[tauri::command]
pub fn check_file_exists(path: String) -> bool {
    std::path::Path::new(&path).exists()
}

// --- テストコード ---
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_atomic_write() {
        let temp_dir = std::env::temp_dir();
        let target_file = temp_dir.join("obcowa_test_file.md");

        let content = b"Test Content! Hello Rust.";
        
        let result = atomic_write(&target_file, content);
        assert!(result.is_ok(), "アトミック書き込みに失敗しました");

        let saved_content = fs::read(&target_file).expect("ファイルが読み込めません");
        assert_eq!(saved_content, content, "保存された内容が一致しません");

        let _ = fs::remove_file(&target_file);
    }
}

    #[test]
    fn test_save_file_content_conflict_check() {
        let temp_dir = std::env::temp_dir();
        let target_file = temp_dir.join("obcowa_conflict_test.md");
        let path_str = target_file.to_string_lossy().to_string();

        // 初期ファイル作成
        let initial_content = "Hello World";
        let initial_mod = save_file_content(path_str.clone(), initial_content.to_string(), 0, true).unwrap();

        // 古いタイムスタンプ（過去の時間）を指定して保存を試みる
        let past_timestamp = initial_mod.saturating_sub(5000);

        // 1. タイムスタンプは異なるが、中身が同じ場合は成功（CONFLICTにならない）することを確認
        let result_same = save_file_content(path_str.clone(), initial_content.to_string(), past_timestamp, false);
        assert!(result_same.is_ok(), "同じ内容であればタイムスタンプが古くても保存に成功するべきです");

        // 2. タイムスタンプが異なり、中身も異なる場合は CONFLICT エラーになることを確認
        let result_different = save_file_content(path_str.clone(), "Hello Modified".to_string(), past_timestamp, false);
        assert_eq!(result_different, Err("CONFLICT".to_string()), "異なる内容の場合は競合エラーが発生するべきです");

        let _ = fs::remove_file(&target_file);
    }
