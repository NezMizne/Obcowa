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
## 検証コマンド（PR作成前に必ず実行すること）
※ 変更がドキュメント（`docs/` や `*.md`）のみの場合は、検証コマンドを実行しない。
※ ソースコードを変更した場合は、従来どおり該当するコマンドを必ず実行する。
- フロントエンド単体テスト: `npx vitest run` （※ `vitest` 単体だと監視モードで止まるため必ず `run` を付けること）
- 型チェック: `npm run check` （※package.jsonにsvelte-checkがある場合）