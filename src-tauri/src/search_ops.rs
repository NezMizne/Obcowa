// 画面上の仮想ツリー（VirtualNode）を対象とした高速ファイル検索コマンドおよび関連処理

use std::fs;
use std::path::Path;
use std::collections::HashMap;
use serde::Serialize;

// 検索結果用の構造体
#[derive(Debug, Serialize, Clone)]
pub struct SearchResultItem {
    pub path: String,
    pub name: String,
    pub snippet: String,
    pub created_at: u64,
    pub updated_at: u64,
}

// バックエンドでの高速な検索処理
#[tauri::command]
pub async fn search_files(
    file_paths: Vec<String>,
    search_by_filename: bool, 
    query: String,
) -> Result<Vec<SearchResultItem>, String> {
    if query.trim().is_empty() {
        return Ok(Vec::new());
    }

    let mut results = Vec::new();
    let query_lower = query.to_lowercase();

    for path in file_paths {
        // メタデータから作成日・更新日を安全に取得 (取得不能なら0)
        let metadata = fs::metadata(&path).ok();
        let created_at = metadata.as_ref().and_then(|m| m.created().ok()).and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok()).map(|d| d.as_secs()).unwrap_or(0);
        let updated_at = metadata.as_ref().and_then(|m| m.modified().ok()).and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok()).map(|d| d.as_secs()).unwrap_or(0);

        let file_name = Path::new(&path)
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();

        if search_by_filename {
            if file_name.to_lowercase().contains(&query_lower) {
                results.push(SearchResultItem {
                    path,
                    name: file_name,
                    snippet: "(ファイル名に一致)".to_string(),
                    created_at,
                    updated_at,
                });
            }
        } else {
            // 必要なファイルのみ本文を読み込む
            if let Ok(content) = fs::read_to_string(&path) {
                let mut in_frontmatter = false;
                let is_tag_query = query_lower.starts_with('#');
                let query_no_hash = if is_tag_query { &query_lower[1..] } else { &query_lower };

                for (i, line) in content.lines().enumerate() {
                    let line_lower = line.to_lowercase();

                    // フロントマター領域の判定 (ファイルの先頭が --- で始まり、次の --- まで)
                    if i == 0 && line.trim() == "---" {
                        in_frontmatter = true;
                    } else if in_frontmatter && i > 0 && line.trim() == "---" {
                        in_frontmatter = false;
                    }

                    // 通常の部分一致、またはフロントマター内のハッシュ無しタグ一致
                    let matched = if line_lower.contains(&query_lower) {
                        true
                    } else {
                        is_tag_query && in_frontmatter && line_lower.contains(query_no_hash)
                    };

                    if matched {
                        let trimmed = line.trim();
                        let snippet = if trimmed.chars().count() > 100 {
                            format!("{}...", trimmed.chars().take(100).collect::<String>())
                        } else {
                            trimmed.to_string()
                        };

                        results.push(SearchResultItem {
                            path,
                            name: file_name,
                            snippet,
                            created_at,
                            updated_at,
                        });
                        break;
                    }
                }
            }
        }
    }
    Ok(results)
}

// ▼ 以下、タグ抽出用の新規追加処理

#[tauri::command]
pub async fn get_workspace_tags(file_paths: Vec<String>) -> Result<HashMap<String, u32>, String> {
    let mut tag_counts: HashMap<String, u32> = HashMap::new();

    for path in file_paths {
        if let Ok(content) = fs::read_to_string(&path) {
            let tags = extract_tags_from_content(&content);
            for tag in tags {
                *tag_counts.entry(tag).or_insert(0) += 1;
            }
        }
    }
    Ok(tag_counts)
}

/// 文字列からフロントマター内のタグと、本文中の #タグ を抽出する
fn extract_tags_from_content(content: &str) -> Vec<String> {
    let mut tags = Vec::new();
    let mut in_frontmatter = false;
    let mut in_tags_section = false;
    let mut in_code_block = false; // コードブロック状態を追跡

    for (i, line) in content.lines().enumerate() {
        let trimmed = line.trim();
        
        // フロントマターの境界判定
        if i == 0 && trimmed == "---" {
            in_frontmatter = true;
            continue;
        } else if in_frontmatter && i > 0 && trimmed == "---" {
            in_frontmatter = false;
            in_tags_section = false;
            continue;
        }

        if in_frontmatter {
            let lower = trimmed.to_lowercase();
            if lower.starts_with("tags:") || lower.starts_with("tag:") {
                in_tags_section = true;
                // インライン配列 (tags: [a, b]) の処理
                if let (Some(start), Some(end)) = (trimmed.find('['), trimmed.find(']')) {
                    let inner = &trimmed[start + 1..end];
                    for t in inner.split(',') {
                        let clean = t.trim().trim_matches(|c| c == '\'' || c == '"' || c == '#');
                        if !clean.is_empty() { tags.push(clean.to_string()); }
                    }
                } else {
                    // カンマ区切り (tags: a, b) の処理
                    let parts: Vec<&str> = trimmed.split(':').collect();
                    if parts.len() > 1 {
                        for t in parts[1].split(',') {
                            let clean = t.trim().trim_matches(|c| c == '\'' || c == '"' || c == '#');
                            if !clean.is_empty() { tags.push(clean.to_string()); }
                        }
                    }
                }
            } else if in_tags_section && trimmed.starts_with('-') {
                // リスト形式 (- tag)
                let clean = trimmed[1..].trim().trim_matches(|c| c == '\'' || c == '"' || c == '#');
                if !clean.is_empty() { tags.push(clean.to_string()); }
            } else if !trimmed.starts_with('-') {
                in_tags_section = false;
            }
        } else {
            
            // --- コードブロックの開始/終了判定 ---
            if trimmed.starts_with("```") || trimmed.starts_with("~~~") {
                in_code_block = !in_code_block;
                continue; // 記号だけの行からは抽出しない
            }
            if in_code_block {
                continue; // コードブロック内はすべて無視
            }

            // 本文からのタグ抽出 (#tag)
            let chars: Vec<char> = line.chars().collect();
            let mut j = 0;
            let mut in_inline_code = false; // インラインコード状態を追跡
            while j < chars.len() {
                if chars[j] == '`' {
                    in_inline_code = !in_inline_code;
                    j += 1;
                    continue;
                }

                // インラインコード (バッククォートで囲まれた領域) の外側でのみ # を探す
                if !in_inline_code && chars[j] == '#' {
                    // 行頭または直前が空白の場合のみタグ開始とみなす
                    if j == 0 || chars[j - 1].is_whitespace() {
                        let mut tag_end = j + 1;
                        while tag_end < chars.len() {
                            let c = chars[tag_end];
                            // タグに含める文字 (英数字, _, -, /)
                            if c.is_alphanumeric() || c == '_' || c == '-' || c == '/' {
                                tag_end += 1;
                            } else {
                                break;
                            }
                        }
                        if tag_end > j + 1 {
                            let tag: String = chars[j + 1..tag_end].iter().collect();
                            tags.push(tag);
                        }
                        j = tag_end;
                        continue;
                    }
                }
                j += 1;
            }
        }
    }
    tags
}