コーディングの際は、以下のドキュメントを読み込んで把握してから作ってください。

プロジェクトの基本情報とルール：
docs/01_project-rules.md

ファイル構成、インポート、関数など：
docs/02_file-map.md

コーディングの共通ルール：
docs/03_instructions.md

---

## 絶対厳守ルール
- npm install や Cargo.toml への新規ライブラリ追加は勝手に行わない（既存のライブラリで解決できない場合のみ相談/PRで提案する）。
- 型エラーを回避するために any や @ts-ignore を使わない。
- src-tauri/capabilities/ の権限やセキュリティ設定を勝手に緩めない。
- テストが通らないからといって、テストコードの期待値を勝手に緩めたりテストを削除したりしない。
## 検証コマンド（PR作成前に必ず実行すること）
- フロントエンド単体テスト: `npx vitest run` （※ `vitest` 単体だと監視モードで止まるため必ず `run` を付けること）
- 型チェック: `npm run check` （※package.jsonにsvelte-checkがある場合）
- Rustのコンパイル確認: `cd src-tauri && cargo check`