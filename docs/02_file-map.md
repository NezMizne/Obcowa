# ディレクトリ構成と主要ファイル

```
A03_Obcowa/
├── .githooks
│   ├── _pre-push
│   └── pre-commit
├── .github
│   └── workflows
│       └── release.yml
├── .gitignore
├── .vscode
│   ├── extensions.json
│   └── settings.json
├── LICENSE.md
├── README.md
├── THIRD_PARTY_LICENSES.txt
├── myicon.png
├── package-lock.json
├── package.json
├── scripts
│   ├── generate_filemap.js
│   ├── generate_filemap.test.js
│   └── generate_licenses.js
├── src
│   ├── app.css
│   ├── app.html
│   ├── components
│   │   ├── Editor
│   │   │   ├── Editor.svelte
│   │   │   ├── EditorHeader.svelte
│   │   │   ├── EditorPreview.svelte
│   │   │   ├── EditorSearch.svelte
│   │   │   ├── TabBar.svelte
│   │   │   ├── markdownSetup.ts
│   │   │   ├── preview.css
│   │   │   ├── previewExtensions.test.ts
│   │   │   └── previewExtensions.ts
│   │   ├── Modals
│   │   │   ├── ConflictDialog.svelte
│   │   │   ├── NewFileModal.svelte
│   │   │   ├── SmartFolderModal.svelte
│   │   │   └── WorkspaceManager.svelte
│   │   ├── RightSidebar
│   │   │   ├── OutlinePanel.svelte
│   │   │   ├── RightSidebar.svelte
│   │   │   ├── TagPanel.svelte
│   │   │   └── outlineUtils.ts
│   │   ├── Settings
│   │   │   ├── SettingsModal.svelte
│   │   │   ├── StyleSettings.svelte
│   │   │   ├── ThemeSettings.svelte
│   │   │   └── ThemeSettings.tst.ts
│   │   ├── Sidebar
│   │   │   ├── SidebarFooter.svelte
│   │   │   ├── SidebarHeader.svelte
│   │   │   ├── SidebarLinks.svelte
│   │   │   └── SidebarTree.svelte
│   │   └── TreeNode.svelte
│   ├── features
│   │   ├── ContextMenu.svelte
│   │   ├── Dashboard
│   │   │   ├── DashboardManager.ts
│   │   │   └── widgets
│   │   │       └── SearchWidget.svelte
│   │   ├── Search
│   │   │   └── SearchSortControl.svelte
│   │   ├── Task
│   │   │   ├── TaskGroupNode.svelte
│   │   │   ├── TaskItem.svelte
│   │   │   └── TaskList.svelte
│   │   ├── launcher
│   │   │   ├── +page.svelte
│   │   │   └── LauncherWindow.svelte
│   │   └── styleSettings
│   │       ├── styleStore.test.ts
│   │       └── styleStore.ts
│   ├── lib
│   │   ├── editor
│   │   │   ├── diffUtils.ts
│   │   │   ├── editorSave.test.ts
│   │   │   ├── editorSave.ts
│   │   │   ├── embedViewer.ts
│   │   │   ├── fileManager.ts
│   │   │   ├── imageViewer.test.ts
│   │   │   ├── imageViewer.ts
│   │   │   ├── mermaidViewer.ts
│   │   │   ├── scrollSync.test.ts
│   │   │   └── scrollSync.ts
│   │   ├── settings
│   │   │   ├── theme.tet.ts
│   │   │   └── theme.ts
│   │   ├── stores.ts
│   │   ├── task
│   │   │   ├── taskService.test.ts
│   │   │   └── taskService.ts
│   │   ├── utils
│   │   │   ├── pathUtils.ts
│   │   │   ├── queryParser.ts
│   │   │   ├── searchUtils.ts
│   │   │   ├── tagUtils.test.ts
│   │   │   └── tagUtils.ts
│   │   └── workspace
│   │       ├── menuUtils.ts
│   │       ├── treeUtils.test.ts
│   │       ├── treeUtils.ts
│   │       ├── workspaceInit.ts
│   │       └── workspaceManager.ts
│   └── routes
│       ├── +layout.svelte
│       ├── +layout.ts
│       └── +page.svelte
├── src-tauri
│   ├── .gitignore
│   ├── 2
│   ├── Cargo.lock
│   ├── Cargo.toml
│   ├── build.rs
│   ├── capabilities
│   │   ├── default.json
│   │   └── desktop.json
│   ├── gen
│   │   └── schemas
│   │       ├── acl-manifests.json
│   │       ├── capabilities.json
│   │       ├── desktop-schema.json
│   │       └── windows-schema.json
│   ├── src
│   │   ├── dashboard_ops.rs
│   │   ├── file_ops.rs
│   │   ├── lib.rs
│   │   ├── main.rs
│   │   ├── models.rs
│   │   ├── search_ops.rs
│   │   └── task_ops.rs
│   └── tauri.conf.json
├── static
│   ├── favicon.png
│   ├── svelte.svg
│   ├── tauri.svg
│   └── vite.svg
├── svelte.config.js
├── test-cases
├── tsconfig.json
└── vite.config.js
```

## 依存関係
📄 `scripts/generate_filemap.js`
  └── import fs
  └── import path

📄 `scripts/generate_filemap.test.js`
  └── import vitest
  └── import ./generate_filemap.js
  └── import $lib/components
  └── import lucide-svelte

📄 `scripts/generate_licenses.js`
  └── import fs
  └── import path
  └── import url

📄 `src/components/Editor/Editor.svelte`
  └── import $lib/stores
  └── import @tauri-apps/api/core
  └── import @tauri-apps/plugin-dialog
  └── import svelte
  └── import lucide-svelte
  └── import ./EditorHeader.svelte
  └── import ./TabBar.svelte
  └── import ./EditorPreview.svelte
  └── import ./EditorSearch.svelte
  └── import ../../lib/editor/editorSave
  └── import ../../lib/editor/scrollSync
  └── import ../../features/Task/TaskList.svelte
  └── import ../../lib/utils/pathUtils
  └── import ../Modals/ConflictDialog.svelte
  └── import ../../lib/editor/fileManager
  └── import ../RightSidebar/RightSidebar.svelte
  └── import lucide-svelte

📄 `src/components/Editor/EditorHeader.svelte`
  └── import @tauri-apps/api/core
  └── import lucide-svelte
  └── import ../../lib/utils/pathUtils

📄 `src/components/Editor/EditorPreview.svelte`
  └── import @tauri-apps/api/core
  └── import svelte
  └── import svelte/store
  └── import ../../lib/stores
  └── import ../../lib/editor/imageViewer
  └── import ../../lib/editor/embedViewer
  └── import ../../lib/editor/mermaidViewer
  └── import @tauri-apps/plugin-opener
  └── import lucide-svelte
  └── import ./previewExtensions
  └── import ../../features/Dashboard/DashboardManager
  └── import ./markdownSetup
  └── import dompurify
  └── import ../../lib/utils/pathUtils

📄 `src/components/Editor/EditorSearch.svelte`
  └── import @tauri-apps/api/core
  └── import ../../lib/stores
  └── import ../../lib/workspace/treeUtils
  └── import lucide-svelte
  └── import ../../features/Search/SearchSortControl.svelte
  └── import ../../lib/utils/searchUtils

📄 `src/components/Editor/TabBar.svelte`
  └── import ../../lib/stores
  └── import @tauri-apps/api/core
  └── import lucide-svelte
  └── import ../../features/ContextMenu.svelte
  └── import ../../lib/workspace/menuUtils
  └── import ../../lib/utils/tagUtils
  └── import svelte
  └── import ../../lib/utils/pathUtils
  └── import ../../lib/editor/fileManager

📄 `src/components/Editor/markdownSetup.ts`
  └── import dompurify
  └── import ./previewExtensions
  └── import ../../lib/utils/queryParser
  └── import unified
  └── import remark-parse
  └── import remark-gfm
  └── import remark-frontmatter
  └── import remark-rehype
  └── import rehype-raw
  └── import rehype-stringify
  └── import remark-breaks
  └── import unist-util-visit
  └── import unist
  └── import mdast
  └── import hast

📄 `src/components/Editor/previewExtensions.test.ts`
  └── import vitest
  └── import ./previewExtensions

📄 `src/components/Editor/previewExtensions.ts`
  └── import svelte/store
  └── import @tauri-apps/api/core
  └── import ../../lib/stores
  └── import ../../lib/workspace/treeUtils

📄 `src/components/Modals/ConflictDialog.svelte`
  └── import ../../lib/editor/diffUtils

📄 `src/components/Modals/NewFileModal.svelte`
  └── import @tauri-apps/api/core
  └── import svelte
  └── import ../../lib/stores

📄 `src/components/Modals/SmartFolderModal.svelte`
  └── import @tauri-apps/api/core
  └── import @tauri-apps/plugin-dialog
  └── import svelte

📄 `src/components/Modals/WorkspaceManager.svelte`
  └── import svelte
  └── import @tauri-apps/plugin-dialog
  └── import ../../lib/stores
  └── import ../../lib/workspace/workspaceManager

📄 `src/components/RightSidebar/OutlinePanel.svelte`
  └── import svelte
  └── import lucide-svelte
  └── import ./outlineUtils

📄 `src/components/RightSidebar/RightSidebar.svelte`
  └── import lucide-svelte
  └── import ./OutlinePanel.svelte
  └── import ./TagPanel.svelte

📄 `src/components/RightSidebar/TagPanel.svelte`
  └── import @tauri-apps/api/core
  └── import svelte
  └── import lucide-svelte
  └── import ../../lib/stores
  └── import ../../lib/workspace/treeUtils

📄 `src/components/Settings/SettingsModal.svelte`
  └── import svelte
  └── import ./ThemeSettings.svelte
  └── import ./StyleSettings.svelte
  └── import ../../features/styleSettings/styleStore
  └── import ../../lib/settings/theme
  └── import ../../lib/stores
  └── import @tauri-apps/plugin-dialog
  └── import ../../lib/stores
  └── import @tauri-apps/api/core
  └── import ../../lib/workspace/workspaceManager
  └── import lucide-svelte

📄 `src/components/Settings/StyleSettings.svelte`
  └── import ../../features/styleSettings/styleStore

📄 `src/components/Settings/ThemeSettings.svelte`
  └── import ../../lib/settings/theme
  └── import svelte/store

📄 `src/components/Settings/ThemeSettings.tst.ts`
  └── import vitest
  └── import @testing-library/svelte
  └── import ./ThemeSettings.svelte
  └── import ../../lib/settings/theme

📄 `src/components/Sidebar/SidebarFooter.svelte`
  └── import @tauri-apps/api/webviewWindow
  └── import lucide-svelte
  └── import ../../lib/stores

📄 `src/components/Sidebar/SidebarHeader.svelte`
  └── import svelte
  └── import @tauri-apps/plugin-dialog
  └── import lucide-svelte
  └── import ../../lib/stores
  └── import ../../lib/workspace/workspaceManager

📄 `src/components/Sidebar/SidebarLinks.svelte`
  └── import @tauri-apps/plugin-opener

📄 `src/components/Sidebar/SidebarTree.svelte`
  └── import ../TreeNode.svelte
  └── import lucide-svelte
  └── import ../../lib/stores
  └── import ../../lib/workspace/workspaceManager
  └── import ../../lib/workspace/treeUtils
  └── import ../../features/ContextMenu.svelte

📄 `src/components/TreeNode.svelte`
  └── import @tauri-apps/api/core
  └── import ../lib/stores
  └── import svelte
  └── import lucide-svelte
  └── import ../lib/utils/tagUtils
  └── import ../features/ContextMenu.svelte
  └── import ../lib/workspace/menuUtils
  └── import ../lib/editor/fileManager

📄 `src/features/ContextMenu.svelte`
  └── import ../lib/workspace/menuUtils
  └── import lucide-svelte

📄 `src/features/Dashboard/DashboardManager.ts`
  └── import svelte
  └── import ./widgets/SearchWidget.svelte

📄 `src/features/Dashboard/widgets/SearchWidget.svelte`
  └── import @tauri-apps/api/core
  └── import svelte
  └── import ../../../lib/stores
  └── import ../../../lib/workspace/treeUtils
  └── import lucide-svelte
  └── import ../../../lib/utils/searchUtils

📄 `src/features/Search/SearchSortControl.svelte`
  └── import ../../lib/stores
  └── import @tauri-apps/api/core
  └── import lucide-svelte
  └── import ../../lib/workspace/workspaceManager

📄 `src/features/Task/TaskGroupNode.svelte`
  └── import lucide-svelte
  └── import ./TaskItem.svelte
  └── import ../../lib/task/taskService
  └── import svelte

📄 `src/features/Task/TaskItem.svelte`
  └── import svelte
  └── import ../../lib/task/taskService

📄 `src/features/Task/TaskList.svelte`
  └── import svelte
  └── import lucide-svelte
  └── import @tauri-apps/api/core
  └── import ../../lib/task/taskService
  └── import ./TaskGroupNode.svelte
  └── import ../../lib/stores
  └── import ../../lib/workspace/treeUtils
  └── import ../ContextMenu.svelte
  └── import ../../lib/workspace/menuUtils
  └── import ../../lib/workspace/workspaceManager

📄 `src/features/launcher/+page.svelte`
  └── import ../../features/launcher/LauncherWindow.svelte

📄 `src/features/launcher/LauncherWindow.svelte`
  └── import svelte
  └── import @tauri-apps/api/core
  └── import @tauri-apps/api/event
  └── import @tauri-apps/api/window

📄 `src/features/styleSettings/styleStore.test.ts`
  └── import vitest
  └── import ./styleStore

📄 `src/features/styleSettings/styleStore.ts`
  └── import svelte/store
  └── import ../../lib/stores

📄 `src/lib/editor/diffUtils.ts`
  └── import diff

📄 `src/lib/editor/editorSave.test.ts`
  └── import vitest
  └── import ./editorSave

📄 `src/lib/editor/editorSave.ts`
  └── import ../utils/pathUtils

📄 `src/lib/editor/embedViewer.ts`
  └── import @tauri-apps/api/core
  └── import svelte/store
  └── import ../stores
  └── import ../workspace/treeUtils
  └── import ../../components/Editor/markdownSetup

📄 `src/lib/editor/fileManager.ts`
  └── import @tauri-apps/api/core
  └── import ../stores

📄 `src/lib/editor/imageViewer.test.ts`
  └── import vitest
  └── import ./imageViewer

📄 `src/lib/editor/imageViewer.ts`
  └── import @tauri-apps/api/core

📄 `src/lib/editor/mermaidViewer.ts`
  └── import mermaid

📄 `src/lib/editor/scrollSync.test.ts`
  └── import vitest
  └── import ./scrollSync

📄 `src/lib/settings/theme.tet.ts`
  └── import vitest
  └── import svelte/store
  └── import ./theme

📄 `src/lib/settings/theme.ts`
  └── import svelte/store

📄 `src/lib/stores.ts`
  └── import svelte/store
  └── import @tauri-apps/api/core
  └── import ./workspace/workspaceManager

📄 `src/lib/task/taskService.test.ts`
  └── import vitest
  └── import ./taskService

📄 `src/lib/task/taskService.ts`
  └── import @tauri-apps/api/core
  └── import ../workspace/treeUtils

📄 `src/lib/utils/queryParser.ts`
  └── import moo

📄 `src/lib/utils/tagUtils.test.ts`
  └── import vitest
  └── import ./tagUtils

📄 `src/lib/workspace/menuUtils.ts`
  └── import lucide-svelte
  └── import svelte

📄 `src/lib/workspace/treeUtils.test.ts`
  └── import vitest

📄 `src/lib/workspace/treeUtils.ts`
  └── import @tauri-apps/api/core

📄 `src/lib/workspace/workspaceInit.ts`
  └── import @tauri-apps/api/core
  └── import ../stores
  └── import ../utils/pathUtils
  └── import ./treeUtils

📄 `src/lib/workspace/workspaceManager.ts`
  └── import svelte/store
  └── import @tauri-apps/api/core
  └── import @tauri-apps/api/event
  └── import ../stores
  └── import svelte/store
  └── import ../stores

📄 `src/routes/+page.svelte`
  └── import svelte
  └── import @tauri-apps/api/core
  └── import @tauri-apps/plugin-dialog
  └── import @tauri-apps/plugin-opener
  └── import @tauri-apps/api/window
  └── import ../components/Editor/Editor.svelte
  └── import ../components/TreeNode.svelte
  └── import ../components/Settings/SettingsModal.svelte
  └── import ../components/Modals/NewFileModal.svelte
  └── import ../components/Modals/SmartFolderModal.svelte
  └── import ../components/Modals/WorkspaceManager.svelte
  └── import ../components/Sidebar/SidebarHeader.svelte
  └── import ../components/Sidebar/SidebarTree.svelte
  └── import ../components/Sidebar/SidebarFooter.svelte
  └── import ../components/Sidebar/SidebarLinks.svelte
  └── import ../lib/settings/theme
  └── import ../features/styleSettings/styleStore
  └── import ../lib/stores
  └── import @tauri-apps/api/event
  └── import ../features/launcher/LauncherWindow.svelte
  └── import ../lib/workspace/treeUtils
  └── import ../lib/utils/pathUtils
  └── import ../lib/workspace/workspaceManager
  └── import ../lib/workspace/workspaceInit

📄 `src-tauri/src/dashboard_ops.rs`
  └── use/mod std::fs
  └── use/mod std::path::PathBuf
  └── use/mod tauri::{AppHandle, Manager}
  └── use/mod crate::file_ops::atomic_write

📄 `src-tauri/src/file_ops.rs`
  └── use/mod std::fs
  └── use/mod std::io::Write
  └── use/mod tauri::{AppHandle, Manager}
  └── use/mod crate::{Workspace, VirtualNode}
  └── use/mod std::path::Path
  └── use/mod encoding_rs::{UTF_8, SHIFT_JIS}
  └── use/mod tests {
    use super::*

📄 `src-tauri/src/lib.rs`
  └── use/mod dashboard_ops
  └── use/mod std::fs
  └── use/mod tauri::Manager
  └── use/mod std::collections::HashMap

📄 `src-tauri/src/models.rs`
  └── use/mod serde::{Deserialize, Serialize}

📄 `src-tauri/src/search_ops.rs`
  └── use/mod std::fs
  └── use/mod std::path::Path
  └── use/mod std::collections::HashMap
  └── use/mod serde::Serialize

📄 `src-tauri/src/task_ops.rs`
  └── use/mod serde::{Deserialize, Serialize}
  └── use/mod std::fs::{self, File, metadata}
  └── use/mod std::io::{self, BufRead, Write}
  └── use/mod std::path::{Path}
  └── use/mod crate::file_ops::atomic_write

📄 `svelte.config.js`
  └── import @sveltejs/adapter-static
  └── import @sveltejs/vite-plugin-svelte

📄 `vite.config.js`
  └── import vite
  └── import @sveltejs/kit/vite
  └── import @tailwindcss/vite

## 各ファイル詳細

### scripts/
- `scripts/generate_filemap.js` : （説明未記載）
  - `export const Extractor`
- `scripts/generate_filemap.test.js` : （説明未記載）
- `scripts/generate_licenses.js` : 依存ライブラリのライセンス全文を収集し、THIRD_PARTY_LICENSES.txt を自動生成するスクリプト
  - `export function generateThirdPartyLicenses()`

### src/components/Editor/
- `src/components/Editor/Editor.svelte` : エディタ画面を統括する親部品
- `src/components/Editor/EditorHeader.svelte` : --- START OF src/components/EditorHeader.svelte ---
  - `export let activeTab`
  - `export let toggleEditMode`
- `src/components/Editor/EditorPreview.svelte` : ユーザーがクリックしたイベントを外に教える　マークダウンのHTML変換を受け取り描画する
  - `export let activeTab`
  - `export let scrollContainer`
  - `export function scrollToHeading(headingIndex: number)`
- `src/components/Editor/EditorSearch.svelte` : 検索機能と結果表示
- `src/components/Editor/TabBar.svelte` : --- START OF src/components/Editor/TabBar.svelte ---
  - `export let handleTabClick`
  - `export let handleTabClose`
- `src/components/Editor/markdownSetup.ts` : Markdown文字列や独自ウィジェットなどを安全なHTMLに変換する
  - `export function removeFrontmatter(content: string)`
  - `export function sanitizeHtml(rawHtml: string)`
  - `export interface ParseOptions`
  - `export async function parseMarkdown(content: string, tabPath: string, options: ParseOptions = {})`
- `src/components/Editor/previewExtensions.test.ts` : 前後のコード明確化: src/features/previewExtensions/previewExtensions.test.ts
- `src/components/Editor/previewExtensions.ts` : プレビュー表示拡張機能（タスク切り替え、コードコピー、見出し折りたたみ）のロジックとDOM操作（描画・変換はしない）
  - `export const COPY_ICON_SVG`
  - `export const CHECK_ICON_SVG`
  - `export function toggleTaskMarkdown(content: string, targetIndex: number)`
  - `export async function copyCodeBlock(buttonEl: HTMLElement)`
  - `export function toggleHeadingCollapse(headingEl: HTMLElement)`
  - `export function toggleCalloutCollapse(titleEl: HTMLElement)`
  - `export async function handleWikiLinkClick(targetEl: HTMLElement)`
  - `export function handleTagClick(targetEl: HTMLElement)`

### src/components/Modals/
- `src/components/Modals/ConflictDialog.svelte` : 責務：ファイル競合時にローカルとリモートの差分を表示し、「上書き」「再読み込み」「保留」を選択させるダイアログ
  - `export let isOpen`
  - `export let filePath`
  - `export let localContent`
  - `export let remoteContent`
  - `export let onResolve`
- `src/components/Modals/NewFileModal.svelte` : --- START OF src/components/Modals/NewFileModal.svelte ---
  - `export let isOpen`
  - `export let targetDir`
- `src/components/Modals/SmartFolderModal.svelte` : --- START OF src/components/Modals/SmartFolderModal.svelte ---
  - `export let isOpen`
  - `export let editingSmartNode`
  - `export let workspaceNodes`
- `src/components/Modals/WorkspaceManager.svelte` : --- START OF src/components/Modals/WorkspaceManager.svelte ---
  - `export let editingListIndex`
  - `export let isCreateModalOpen`
  - `export let isManageModalOpen`

### src/components/RightSidebar/
- `src/components/RightSidebar/OutlinePanel.svelte` : 責務: 見出しの抽出、検索フィルタリング、リスト表示とクリック時のジャンプイベント発行
  - `export let activeTab`
- `src/components/RightSidebar/RightSidebar.svelte` : 責務: 右サイドバーの親枠。将来タブが増えた際の切り替えや閉じる処理を担う
  - `export let activeTab`
  - `export let onClose`
- `src/components/RightSidebar/TagPanel.svelte` : 責務: ワークスペース内のタグを階層ツリー化して表示し、検索と連動する
- `src/components/RightSidebar/outlineUtils.ts` : 責務: Markdownから見出しを抽出する純粋関数
  - `export interface OutlineItem`
  - `export function extractHeadings(markdown: string)`
  - `export function getVisibleHeadings(headings: OutlineItem[], collapsedIndices: Set<number>)`
  - `export function hasChildHeading(headings: OutlineItem[], index: number)`

### src/components/Settings/
- `src/components/Settings/SettingsModal.svelte` : --- START OF src/components/SettingsModal.svelte ---
- `src/components/Settings/StyleSettings.svelte` : --- START OF src/components/StyleSettings.svelte ---
  - `export let tempStyle`
  - `export let tempCustomSlots`
  - `export let defaultStyle`
- `src/components/Settings/ThemeSettings.svelte` : （説明未記載）
  - `export let tempTheme`
  - `export function applyPreset()`
  - `export function saveCustomTheme()`
- `src/components/Settings/ThemeSettings.tst.ts` : （説明未記載）

### src/components/Sidebar/
- `src/components/Sidebar/SidebarFooter.svelte` : サイドバー下部のリスト切り替え・設定ボタン
  - `export let editingListIndex`
  - `export let isCreateModalOpen`
  - `export let isManageModalOpen`
  - `export let openSettings`
- `src/components/Sidebar/SidebarHeader.svelte` : サイドバー上部の新規追加ボタン等
- `src/components/Sidebar/SidebarLinks.svelte` : 責務: サイドバー内の外部リンク一覧の表示・コンテキストメニューおよび開く処理の管理
  - `export let links`
  - `export let onLinkDelete`
- `src/components/Sidebar/SidebarTree.svelte` : サイドバーのツリー表示とピン留め

### src/components/
- `src/components/TreeNode.svelte` : 責務: ワークスペース内の単一ファイル・フォルダ（ノード）を表示し、再帰的な展開とユーザー操作（開く・右クリックメニュー・インライン編集）を処理するUIコンポーネント
  - `export let node`
  - `export let ownerId`
  - `export let parentSortBy`
  - `export let parentSortOrder`

### src/features/
- `src/features/ContextMenu.svelte` : 右クリックメニューのUI。画面外をクリックしたら自動で閉じる
  - `export let x`
  - `export let y`
  - `export let items`
  - `export let openSubLeft`
  - `export let onClose`

### src/features/Dashboard/
- `src/features/Dashboard/DashboardManager.ts` : プレビュー画面上のプレースホルダー(div)にSvelteコンポーネントをマウント・アンマウントする (Svelte 5対応版)
  - `export function unmountAllWidgets()`
  - `export function mountWidgets(container: HTMLElement)`

### src/features/Dashboard/widgets/
- `src/features/Dashboard/widgets/SearchWidget.svelte` : 渡されたクエリで検索を実行し、結果をコンパクトなリストで表示する
  - `export let query`
  - `export let sortKey`
  - `export let sortOrder`

### src/features/Search/
- `src/features/Search/SearchSortControl.svelte` : 検索ソートのアイコンUIと、状態の永続化保存

### src/features/Task/
- `src/features/Task/TaskGroupNode.svelte` : 責務: ワークスペースの未完了タスク一覧において、階層構造（ファイル・見出し）を再帰的に描画し、折りたたみ制御を行う
  - `export let node`
  - `export let groupBy`
  - `export let isUpdatingTasks`
  - `export let depth`
- `src/features/Task/TaskItem.svelte` : タスク1件分のUI表示と、チェックボックス操作のイベント発火
  - `export let task`
  - `export let isUpdating`
- `src/features/Task/TaskList.svelte` : 責務: ワークスペースの未完了タスク一覧を表示し、更新を管理する親コンポーネント
  - `export let workspaceIndex`

### src/features/launcher/
- `src/features/launcher/+page.svelte` : 責務: ランチャーウィンドウ用のルーティングエントリポイント
- `src/features/launcher/LauncherWindow.svelte` : 責務: 独立した小ウィンドウでワークスペースの一覧を表示し、選択結果をメイン画面に送信する

### src/features/styleSettings/
- `src/features/styleSettings/styleStore.test.ts` : （説明未記載）
- `src/features/styleSettings/styleStore.ts` : （説明未記載）
  - `export interface HeadingStyle`
  - `export interface StyleSlot`
  - `export const defaultStyle`
  - `export const activeStyleSlot`
  - `export const customStyleSlots`
  - `export function generateStyleCssVariables(style: StyleSlot)`
  - `export function applyStyleToRoot(style: StyleSlot)`
  - `export function initStyles()`

### src/lib/editor/
- `src/lib/editor/diffUtils.ts` : 外部ファイルとローカルエディタ間のテキスト差分を計算し、Side-by-side表示用のブロック配列を生成する
  - `export interface DiffBlock`
  - `export function computeSideBySideDiff(remoteText: string, localText: string)`
- `src/lib/editor/editorSave.test.ts` : editorSave関数の単体テスト
- `src/lib/editor/editorSave.ts` : エディタの保存処理、競合ダイアログハンドリングの純粋・抽象化ロジック
  - `export interface SaveDependencies`
  - `export interface BaseTabData`
- `src/lib/editor/embedViewer.ts` : プレビュー内のノート埋め込みプレースホルダーを検出し、非同期でコンテンツを取得して描画する
  - `export async function loadEmbedsInDom(container: HTMLElement, currentFilePath: string, embedStack: string[] = [])`
- `src/lib/editor/fileManager.ts` : 責務: SvelteからRust(Tauri)へのファイル保存リクエストを直列化（キュー管理）し、競合を防ぐ
  - `export function requestSaveFile(path: string, content: string, lastModified: number, force: boolean)`
  - `export async function saveAndUpdateTab(path: string, content: string, lastModified: number, force: boolean)`
- `src/lib/editor/imageViewer.test.ts` : --- START OF src/lib/imageViewer.test.ts ---
- `src/lib/editor/imageViewer.ts` : プレビュー内の画像プレースホルダーを検出し、ローカル画像の検索・バイナリ読込・Blobキャッシュと表示反映を行う
  - `export async function loadImagesInDom(container: HTMLElement, activeTabPath: string, imageFolders: string[] = [])`
- `src/lib/editor/mermaidViewer.ts` : Mermaid記法のプレースホルダーを見つけ、SVG画像に変換して画面にマウントする責務を持つ
  - `export async function loadMermaidInDom(container: HTMLElement)`
- `src/lib/editor/scrollSync.test.ts` : scrollSync関数の単体テスト
- `src/lib/editor/scrollSync.ts` : 編集エリアとプレビューエリア間のスクロール位置比率の計算を行う純粋関数
  - `export function calculateScrollRatio(scrollTop: number, scrollHeight: number)`
  - `export function calculateScrollTopFromRatio(ratio: number, scrollHeight: number)`

### src/lib/settings/
- `src/lib/settings/theme.tet.ts` : （説明未記載）
- `src/lib/settings/theme.ts` : テーマ設定のプリセット、起動時テーマ復元処理、テーマ適用
  - `export interface Theme`
  - `export const defaultThemes`
  - `export const activeTheme`
  - `export const customThemes`
  - `export function initTheme()`
  - `export function applyThemeToRoot(theme: Theme)`

### src/lib/
- `src/lib/stores.ts` : Svelte Store（タブの状態、ワークスペース一覧などをグローバル管理）
  - `export interface TabData`
  - `export const workspacesStore`
  - `export const openTabs`
  - `export const activeTabId`
  - `export const workspaces`
  - `export const currentWorkspace`
  - `export const editorFont`
  - `export const currentWorkspaceIndex`
  - `export const registeredTags`
  - `export const searchState`
  - `export const expandTreeRequest`
  - `export function openSearchTab()`
  - `export function openTaskTab()`
  - `export function switchTab(tabId: string)`
  - `export function openFileInCurrentTab(filePath: string, title: string, initialContent: string)`
  - `export function openFileInNewTab(filePath: string, title: string, initialContent: string)`
  - `export function createNewTab()`
  - `export function closeTab(idToClose: string)`
  - `export const showLauncherOnStartup`
  - `export async function openDashboardTab(workspaceId: string, workspaceName: string)`

### src/lib/task/
- `src/lib/task/taskService.test.ts` : taskServiceの単体テスト
- `src/lib/task/taskService.ts` : Tauriと通信し、タスクの取得および完了処理を行うAPIサービス
  - `export interface Task`
  - `export type GroupByOption`
  - `export type SortOption`
  - `export interface TaskTreeNode`
  - `export interface TaskScanOptions`
  - `export async function fetchWorkspaceTasks(nodes: any[], options?: TaskScanOptions)`
  - `export async function completeTaskStatus(task: Task, completed: boolean = true)`
  - `export function sortTaskTreeNodes(nodes: any[], sortOption: SortOption)`

### src/lib/utils/
- `src/lib/utils/pathUtils.ts` : アプリ内の特殊なパス（仮想タブ）の判定を共通化する
  - `export function isSpecialPath(path: string | undefined | null)`
  - `export function isDashboardPath(path: string | undefined | null)`
  - `export function getWorkspaceIdFromDashboardPath(path: string | undefined | null)`
- `src/lib/utils/queryParser.ts` : mooを用いてDataview風構文を安全にパースする
  - `export function parseDataviewQuery(rawQuery: string)`
- `src/lib/utils/searchUtils.ts` : 検索結果配列を副作用なく並び替える純粋関数
  - `export function sortSearchResults(results: any[], key: string, order: string)`
- `src/lib/utils/tagUtils.test.ts` : （説明未記載）
- `src/lib/utils/tagUtils.ts` : タグの文字列処理など（純粋関数）
  - `export function extractTags(content: string)`
  - `export function updateTagsInContent(content: string, tag: string, isAdd: boolean)`

### src/lib/workspace/
- `src/lib/workspace/menuUtils.ts` : 右クリックメニューを表示するデータ構造を定義し、ファイル共通のアクションを生成
  - `export interface MenuItem`
  - `export interface FileMenuParams`
  - `export function buildCommonFileMenu(params: FileMenuParams)`
  - `export interface TreeNodeMenuParams`
  - `export function buildTreeNodeMenu(params: TreeNodeMenuParams)`
- `src/lib/workspace/treeUtils.test.ts` : 責務: treeUtils関数の単体テスト
- `src/lib/workspace/treeUtils.ts` : ワークスペースのノードツリー最新化およびスマートフォルダ評価、ワークスペースのファイル一覧取得
  - `export function getPinnedNode(pin: any, workspace: any)`
  - `export function getSortedNodes(nodes: any[], sortBy = 'name', sortOrder = 'asc')`
  - `export function groupNodesByCategory(nodes: any[], categoryOrder: string[] = [], sortBy = 'name', sortOrder = 'asc')`
  - `export async function refreshTree(nodes: any[], workspaceNodes: any[], parentSortBy?: string, parentSortOrder?: string)`
  - `export function buildFilenameIndex(nodes: any[])`
  - `export function searchFilesByName(nodes: any[], query: string)`
  - `export function extractFilePaths(nodes: any[])`
- `src/lib/workspace/workspaceInit.ts` : 責務: アプリ起動時におけるワークスペースの読み込み、タブ復元、初期バックグラウンド同期
  - `export interface SavedTabInfo`
  - `export async function restoreTabs(savedTabs: SavedTabInfo[])`
  - `export async function initializeWorkspaceSession(searchQuery: string)`
- `src/lib/workspace/workspaceManager.ts` : 責務: ワークスペースデータの永続化（他ウィンドウとの競合マージと保存の直列化）
  - `export function requestSaveWorkspaces(forceOverwrite = false)`
  - `export function getNodePath(node: any)`
  - `export async function removeNodeFromWorkspace(targetNode: any, ownerId: string)`
  - `export function pinNodeToWorkspace(targetNode: any)`
  - `export function unpinNodeFromWorkspace(path: string)`
  - `export function isNodePinned(targetNode: any)`
  - `export function getWorkspaceClickBehavior()`
  - `export function getWorkspaceGlobalSort()`
  - `export function setWorkspaceNodeSort(node: any, by: string, order: string)`
  - `export function setNodeCategory(targetNode: any, newCategory: string)`
  - `export function setWorkspaceNodeCategory(targetNode: any, newCategory: string)`

### src/routes/
- `src/routes/+layout.svelte` : （説明未記載）
- `src/routes/+layout.ts` : Tauri doesn't have a Node.js server to do proper SSR
  - `export const ssr`
- `src/routes/+page.svelte` : アプリのメイン画面（ガワ）。全体のデータとモーダル状態を管理。

### src-tauri/
- `src-tauri/build.rs` : （説明未記載）

### src-tauri/src/
- `src-tauri/src/dashboard_ops.rs` : アプリ設定ディレクトリ内でのダッシュボード専用ファイルの読み込みと、アトミック保存を行う
  - `pub fn load_dashboard(app: AppHandle, workspace_id: String) -> Result<String, String>`
  - `pub fn save_dashboard(app: AppHandle, workspace_id: String, content: String) -> Result<(), String>`
- `src-tauri/src/file_ops.rs` : ファイル保存、読み込み関係。
  - `pub fn atomic_write(path: &Path, content: &[u8]) -> Result<(), String>`
  - `pub fn get_file_modified(path: String) -> Result<u64, String>`
  - `pub fn save_workspaces(app: AppHandle, workspaces: Vec<Workspace>) -> Result<(), String>`
  - `pub fn load_workspaces(app: AppHandle) -> Result<Vec<Workspace>, String>`
  - `pub fn read_image_bytes(path: String) -> Result<Vec<u8>, String>`
  - `pub fn save_file_content(path: String, content: String, last_modified: u64, force: bool) -> Result<u64, String>`
  - `pub fn read_file_content(path: String) -> Result<String, String>`
  - `pub fn read_directory( path: String, sort_by: Option<String>, sort_order: Option<String> ) -> Result<Vec<VirtualNode>, String>`
  - `pub fn create_new_file(dir_path: String, file_name: String, insert_tag: String) -> Result<(), String>`
  - `pub fn open_folder(path: String) -> Result<(), String>`
  - `pub async fn find_image_file(dir_path: String, file_name: String) -> Result<Option<String>, String>`
  - `pub fn check_file_exists(path: String) -> bool`
- `src-tauri/src/lib.rs` : 全てのTauriコマンド（ファイル検索、OS連携など）が書かれたメイン処理。（今後は少しずつ分割する）
  - `pub fn run()`
- `src-tauri/src/main.rs` : Prevents additional console window on Windows in release, DO NOT REMOVE!!
- `src-tauri/src/models.rs` : アプリケーション全体で使用する共通データモデル（Workspace, VirtualNode など）の定義
  - `pub struct PinnedItem`
  - `pub struct LinkItem`
  - `pub struct SavedTab`
  - `pub enum SmartCondition`
  - `pub struct SmartRules`
  - `pub enum VirtualNode`
  - `pub struct Workspace`
- `src-tauri/src/search_ops.rs` : 画面上の仮想ツリー（VirtualNode）を対象とした高速ファイル検索コマンドおよび関連処理
  - `pub struct SearchResultItem`
  - `pub async fn search_files( file_paths: Vec<String>, search_by_filename: bool, query: String, ) -> Result<Vec<SearchResultItem>, String>`
  - `pub async fn get_workspace_tags(file_paths: Vec<String>) -> Result<HashMap<String, u32>, String>`
- `src-tauri/src/task_ops.rs` : 責務: ワークスペース内のタスク検索と、タスク状態の安全な更新処理
  - `pub struct Task`
  - `pub struct ScanOptions`
  - `pub async fn get_workspace_tasks( file_paths: Vec<String>, options: Option<ScanOptions> ) -> Result<Vec<Task>, String>`
  - `pub fn complete_task( file_path: String, line_number: usize, original_text: String, completed: Option<bool>, ) -> Result<(), String>`

- `svelte.config.js` : Tauri doesn't have a Node.js server to do proper SSR
- `vite.config.js` : （説明未記載）

