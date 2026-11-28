# プロジェクトの基本情報とルール

## 技術スタック
- フロントエンド: SvelteKit (Svelte 4/5), TailwindCSS, lucide-svelte, Vitest
- バックエンド: Tauri v2 (Rust)
- DB/認証: なし（ローカルの.md/.txtファイルを直接操作）
- 通信: Tauri IPC (フロントから `invoke` でRustを呼び出す)

## コンセプト
Obsidianを母艦として、プロジェクトごとにワークスペースを構成できるMarkdownエディタ。
ファイル・ワークスペースが消えないこと、Obsidianの管理に干渉しないことを優先する。

## 絶対ルール（AIへの指示）
- **Svelte 4 / 5 記法の統一ルール**:
  - `package.json` 上の `svelte` は v5 だが、`.svelte` コンポーネントはすべて **Svelte 4 記法**（`export let`, `$:`, `createEventDispatcher`, `on:click` 等）で統一すること。
  - `.svelte` ファイル内で Svelte 5 Runes（`$state`, `$derived`, `$effect`, `$props`）は使用しないこと（既存コードとの混在を防ぐため）。
  - 例外: `src/features/Dashboard/DashboardManager.ts` の動的マウント処理でのみ Svelte 5 の `mount` / `unmount` API を使用している。

- **データモデル・Tauri IPC 参照ルール**:
  - Rust 側（`src-tauri/src/models.rs` および各 `#[tauri::command]`）の型定義・引数名（camelCase変換済み）・戻り値型は、自動生成ファイル `src/lib/tauri/generated.ts` に一元化されている。
  - 新規実装で `Workspace`, `VirtualNode`, `Task` 等を扱う場合は独自に型を再定義したり `any` を使ったりせず、`src/lib/tauri/generated.ts` からインポートすること。
  - 新規に Tauri コマンドを呼び出す場合は、まず `src/lib/tauri/generated.ts` の `TauriCommandMap` / `invokeCommand` を参照・使用すること（ただし下記の `save_workspaces` / `save_file_content` 直呼び出し禁止ルールは厳守）。
  - Rust 側のモデルやコマンドを変更した際は、`npm run doc:tauri`（または `pre-commit` フック）で `src/lib/tauri/generated.ts` を同期すること。

- **テーマ・スタイル対応（CSS変数一覧）**:
  - Tailwind で `bg-gray-700` のような具体的な色指定は禁止。必ず以下の CSS 変数を使うこと。
  - 定義元: テーマ色は `src/lib/settings/theme.ts`、エディタ文字・見出しスタイルは `src/features/styleSettings/styleStore.ts`。
【使用可能なCSS変数一覧】
  - テーマ色（`theme.ts`）:
    - `var(--bg-color)` : メイン背景色
    - `var(--text-color)` : メイン文字色
    - `var(--menu-bg)` : メニューやサイドバーの背景色
    - `var(--active-highlight-bg)` : ホバー時や選択時の背景色
    - `var(--accent-color)` : ボタンやアイコンのアクセントカラー
    - `var(--selection-bg)` : 文字を選択したときの背景色
    - `var(--scroll-bg)` : スクロールバーのトラック背景色
    - `var(--scroll-thumb)` : スクロールバーのつまみ色
  - エディタ・見出しスタイル（`styleStore.ts`）:
    - `var(--editor-font)` : エディタフォントファミリー
    - `var(--editor-font-size)` : エディタ文字サイズ（px）
    - `var(--editor-line-height)` : エディタ行間
    - `var(--h1-size)` 〜 `var(--h6-size)` : 各見出しの文字サイズ（rem）
    - `var(--h1-border)` 〜 `var(--h6-border)` : 各見出しの下線
    - `var(--h1-style)` 〜 `var(--h6-style)` : 各見出しの斜体設定（`italic` / `normal`）
    - `var(--h1-weight)` 〜 `var(--h6-weight)` : 各見出しの太字設定（`bold` / `normal`）
※半透明にしたい場合は `color-mix(in srgb, var(--text-color) 20%, transparent)` のようにすること。
アクセントカラーを文字色に使うときは、テキスト色を混ぜる
例：color-mix(in srgb, var(--accent-color) 80%, var(--text-color))

- **ワークスペース設定（workspaces.json）の保存ルール**:
  - 各コンポーネントから Tauri の `invoke('save_workspaces')` を直接呼び出すことは**厳禁**（データの巻き戻り・Race Conditionの原因になるため）。
  - 設定の保存は必ず `src/lib/workspace/workspaceManager.ts` の `requestSaveWorkspaces()` を使用すること。この関数が内部で直列化（キュー）とウィンドウ間マージを安全に行う。
  - ワークスペースのデータはローカル変数で保持・バケツリレーせず、グローバルストア `$workspacesStore` を直接参照・`workspacesStore.update()` で更新すること。

- **ファイルの保存（save_file_content）に関するルール**:
  - 各コンポーネントから Tauri の `invoke('save_file_content')` を直接呼び出すことは**厳禁**（自動保存とユーザー操作が衝突し、データの巻き戻りや競合エラーが起きるため）。
  - ファイルの保存は必ず `src/lib/editor/fileManager.ts` を経由し、保存処理の直列化（キュー）を通すこと。
  - 用途に応じて以下の関数を使い分けること：
    - `requestSaveFile()`: 単純にファイルを保存したい場合、または保存用の一連のプロセス（競合ダイアログ等）に組み込む場合に使用する。
    - `saveAndUpdateTab()`: サイドバーや右クリックメニューなどからの「直接操作」でファイルを保存し、かつ**もしそのファイルがタブで開かれていればStoreの情報（内容や更新日時）も一括で安全（イミュータブル）に最新化したい**場合に使用する。

- **状態管理・永続化・イベントの参照先（Single Source of Truth）**:
  各仕組みの定義・型・定数は以下のソースコードに一元化されている。新規実装や修正時は直書きや独自定義を避け、正となるファイルを直接参照すること。
  - **グローバルストア（Store / `TabData`）**: `src/lib/stores.ts`（ワークスペースデータは `workspacesStore` を単一ソースとする）
  - **ワークスペース生成・永続化・同期**: `src/lib/workspace/workspaceManager.ts`（`createDefaultWorkspace`, `requestSaveWorkspaces`, `initWorkspaceSyncListener`）
  - **Context（`workspaceActions`）**: `src/lib/workspace/workspaceContext.ts`（`WorkspaceActionsContext`, `setWorkspaceActions`, `getWorkspaceActions`, `getOptionalWorkspaceActions`）
  - **`localStorage` キー定数**: `src/lib/settings/storageKeys.ts`（`STORAGE_KEYS`）
  - **Tauri ウィンドウ間イベント**: `src/lib/tauri/events.ts`（`APP_EVENTS`, `AppEventMap`, `emitAppEvent`, `listenAppEvent`）

- **ファイルの配置ルール（Co-locationの原則）**:
  - 単一のコンポーネントでしか使わないロジック・テストは、そのコンポーネントと同じディレクトリ内に配置すること（例: `src/components/Editor/previewExtensions.ts`）。
  - アプリから独立した大きな画面や機能ユニット（ランチャーや設定等）、フォルダの違う複数コンポーネントから呼び出される処理は `src/features/機能名/` 配下にまとめること。
  - アプリ全体（複数コンポーネント）で横断利用する共通ロジックやストアは `src/lib/` 配下に配置すること。

- **Tauri APIの使用は必要最小限にする**
Tauri APIはOS・ウィンドウ・ネイティブ機能との境界に限定して使用する。アプリ固有のロジックはTauriに依存させない。新たにTauri APIを使用する場合は、ブラウザ標準APIや既存の抽象化で代替できないか確認する。

- **マークダウン表示と独自拡張のアーキテクチャ分離ルール**:
  プレビュー表示や独自記法の追加は、必ず以下の3つの責務（係）を完全に分離して実装すること。
  1. **変換係（ `markdownSetup.ts` ）**: 
     - 役割: Markdown文字列を安全なHTMLに変換する純粋関数。
     - 厳守事項: ここで `get(store)` によるストアの参照や、Tauri APIの呼び出し（副作用）を絶対に行わないこと。独自記法（画像、リンク、ウィジェット等）を変換する際は、機能を持たせず `<div data-widget-type="...">` や `<img data-img-filename="...">` のような「目印（プレースホルダー）」のHTMLを出力するだけに留めること。
  2. **描画・ウィジェット係（ `DashboardManager.ts`, `imageViewer.ts` など ）**: 
     - 役割: 変換されたHTMLが画面に描画された後、目印（プレースホルダー）を探して実体（Svelteコンポーネントや画像のバイナリ）を流し込む。
     - 厳守事項: 複雑なUIや非同期通信を伴う拡張（検索ウィジェットなど）は、独立した `.svelte` コンポーネントとして作成し、ここでマウントすること。
  3. **アクション係（ `previewExtensions.ts` ）**: 
     - 役割: プレビュー画面でのユーザークリック等のイベントを処理する。
     - 厳守事項: 画面上のDOM操作（見出しの折りたたみ等）、Tauriやストアを動かすアプリロジック（リンクを開く等）、元のMarkdownテキストの書き換え（タスクのチェック等）はここに集約すること。
  - **Markdown パイプライン順序 & DOMPurify 拡張手順（重要）**:
    - `src/components/Editor/markdownSetup.ts` の `unified` パイプラインは順序依存がある。特に `remarkGfm` は `remarkParse` 直後、`remarkBreaks` は独自記法（Callout・Wikiリンク・タグ等）のパース後に配置すること。
    - 独自記法で新しい HTML タグや `data-*` 属性を出力する場合は、**同じファイル内の `sanitizeHtml()` にある DOMPurify ホワイトリスト（`ADD_TAGS`, `ADD_ATTR`）にも必ず追記すること**（追記しないとサニタイズ時に属性・タグが除去される）。
    - 拡張・変更時は `src/components/Editor/markdownSetup.test.ts` にテストを追加し、サニタイズ後も期待するタグと属性が残ることを検証すること。

- 特殊パス（仮想タブ）はsrc/lib/utils/pathUtils.tsで管理する。新しい機能を作ったらここに追記。
- 既存のコードでリファクタリングできそうな部分（責務の分離など）があれば教えてください
- OSSで公開するので、セキュリティリスク（開発者の情報漏洩）などがある場合は通知する。
- マークダウンの表示やメニューアイコンなどは、特に指示がない場合はObsidian風にする

- **テストコード作成・保守ルール（Vitest / Rust）**:
  - **ファイル名と配置**: テストは対象ファイルと同じディレクトリに配置し、拡張子は必ず `*.test.ts`（または `*.test.js` / `*.spec.{js,ts}`）とすること（`vite.config.js` の対象は `src/**/*.{test,spec}.{js,ts}` と `scripts/**/*.{test,spec}.{js,ts}`）。新規作成時は1行目に責務コメントを記載する（`docs/02_file-map.md` 自動生成対応）。
  - **Tauri 共通モックの活用**: `@tauri-apps/api/core`（`invoke`）と `@tauri-apps/api/event`（`emit`, `listen`）は `src/test/setup.ts` で共通モックされている。テストごとの振る舞いは原則 `vi.mocked(invoke)` を `beforeEach` で `mockReset()` / `mockImplementation()` して制御すること（上記以外の Tauri プラグインを使う場合のみ個別に `vi.mock` する）。
  - **トップレベル副作用の禁止**: テストからのインポートでクラッシュしないよう、各モジュールのトップレベルで `listen()` / `invoke()` / DOM 操作等の副作用を実行しないこと（初期化は `init*()` 等の関数に切り出す）。
  - **型安全・期待値の厳守**: テスト内でも `any` や `@ts-ignore` を使用せず、`src/lib/tauri/generated.ts` 等の正規の型を使い `svelte-check` を通すこと。テスト失敗時に期待値を安易に緩めたりテストを削除したりせず、最新ソースコードとテストのどちらが正か確認して修正すること。
  - **テスト間の状態分離**: `localStorage`、Svelte Store、ブラウザ API スタブ（`URL.createObjectURL` 等）を触るテストは `beforeEach` / `afterEach` で必ず初期化・復元すること。
  - **Rust 単体テスト**: `src-tauri/src/` にテストを書く場合は、対象ファイル末尾の `#[cfg(test)] mod tests { use super::*; ... }` ブロック内に収め、作成した一時ファイルはテスト内で削除すること。
