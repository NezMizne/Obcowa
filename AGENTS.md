コーディングの際は、以下のドキュメントを読み込んで把握してから作ってください。

プロジェクトの基本情報とルール：
docs/01_project-rules.md

ファイル構成、インポート、関数など：
docs/02_file-map.md

データモデル・Tauri IPCコマンド型定義（Rustから自動生成）：
src/lib/tauri/generated.ts

コーディングの共通ルール：
docs/03_instructions.md

機能別の設計仕様書（ADR）：
（※過去の設計判断の記録であり、現在の実装と差異がある場合は最新のソースコードを正とすること）
- ダッシュボード機能: docs/adr/dashboard.md
- アウトライン（目次）機能: docs/adr/design_outline_feature.md
- プレビュー拡張機能: docs/adr/preview-extensions.md
- 検索・ウィジェットのソート拡張: docs/adr/search_sort_widget.md
- タスク一覧管理: docs/adr/task-list.md
- タスクソート・ネスト追従: docs/adr/task-sort-and-nest.md
- Wikiリンク・独自記法パース設計: docs/adr/wikiLink_obsidianMD.md
- ワークスペース保存フロー: docs/adr/workspace-save-flow.md

---

## 絶対厳守ルール
- npm install や Cargo.toml への新規ライブラリ追加は勝手に行わない（既存のライブラリで解決できない場合のみ相談/PRで提案する）。
- 型エラーを回避するために any や @ts-ignore を使わない。
- src-tauri/capabilities/ の権限やセキュリティ設定を勝手に緩めない。
- テストが通らないからといって、テストコードの期待値を勝手に緩めたりテストを削除したりしない。

## 検証コマンド（作業完了時・PR作成前に実施）

※ 変更がドキュメント（`docs/` や `*.md`）のみの場合は、検証は不要。
※ ソースコードを変更した場合は、該当する検証コマンドを**AI自身が実行せず**、ユーザーに実行を依頼すること。

### AIの振る舞いルール
1. **シェルコマンドを自動実行しない**：`execute_command` 等のコマンド実行ツールは使用せず、実行すべきコマンドをユーザーへテキストで提示して作業を一時停止すること。
2. **ログ出力付きコマンドを提示する**：検証が必要な場合は、以下のとおり `tmp/verify.log` へ結果を出力するコマンドを提示し、ユーザーに実行と完了報告を依頼すること。
3. **完了報告を受けたらログを読む**：ユーザーから「終了した」旨の報告を受けたら、`tmp/verify.log` を読み取ってエラーの有無を確認し、問題があれば修正、なければ完了報告を行うこと。

### 提示するコマンド一覧（Windows PowerShell）
（※ 実行ポリシーにより `npx` / `npm` がブロックされる環境では、`npx.cmd` / `npm.cmd` を使用してください）
- フロントエンド単体テスト:
  `npx.cmd vitest run 2>&1 | Out-File -Encoding utf8 tmp/verify.log`
  （※ `vitest` 単体だと監視モードで止まるため必ず `run` を付けること）
- 型チェック:
  `npm.cmd run check 2>&1 | Out-File -Encoding utf8 tmp/verify.log`
  （※ `package.json` に `svelte-check` がある場合）
- バックエンド（Rust）ビルド・単体テスト（`src-tauri/` を変更した場合）:
  `cargo test --manifest-path src-tauri/Cargo.toml 2>&1 | Out-File -Encoding utf8 tmp/verify.log`
  （※ `.githooks/_pre-push` と同等の検証。コンパイルチェックのみの場合は `cargo check --manifest-path src-tauri/Cargo.toml`）
- フロントエンド一括実行する場合:
  `npx.cmd vitest run 2>&1 | Out-File -Encoding utf8 tmp/verify.log; npm.cmd run check 2>&1 | Out-File -Encoding utf8 -Append tmp/verify.log`