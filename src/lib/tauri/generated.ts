// Rust側のデータモデルおよびTauri IPCコマンドの自動生成型定義（手動編集禁止）
// 再生成コマンド: npm run doc:tauri

import { invoke } from '@tauri-apps/api/core';

// ============================================
// 1. データモデル (Rust struct / enum 由来)
// ============================================

export interface PinnedItem {
    item_type: string;
    name: string;
    path: string;
}

export interface LinkItem {
    id: string;
    title: string;
    url: string;
}

export interface SavedTab {
    id: string;
    path: string;
    title: string;
    isEditing: boolean;
}

export type SmartCondition =
    | { cond_type: 'Tag'; tag: string; match_mode: string; include_inline: boolean; is_exclude: boolean }
    | { cond_type: 'Date'; date_type: string; limit: number };

export interface SmartRules {
    target_dir: string;
    target_workspace: boolean;
    match_type: string;
    conditions: SmartCondition[];
    keep_structure: boolean;
}

export type VirtualNode =
    | { type: 'Folder'; name: string; original_path?: string | null; children: VirtualNode[]; smart_rules?: SmartRules | null; sort_by?: string | null; sort_order?: string | null; category?: string | null }
    | { type: 'File'; name: string; path: string; created: number; modified: number; category?: string | null };

export interface Workspace {
    id: string;
    name: string;
    category: string;
    nodes: VirtualNode[];
    links: LinkItem[];
    pinned: PinnedItem[];
    linked_libraries: string[];
    is_flat: boolean;
    open_in_new_tab: boolean;
    saved_tabs: SavedTab[];
    active_tab_id?: string | null;
    editor_font: string;
    category_order: string[];
    sort_by: string;
    sort_order: string;
    search_sort_by: string;
    search_sort_order: string;
    task_exclude_paths?: string[] | null;
    task_exclude_headings?: string[] | null;
    image_folders?: string[] | null;
    show_properties?: boolean | null;
}

export interface SearchResultItem {
    path: string;
    name: string;
    snippet: string;
    created_at: number;
    updated_at: number;
}

export interface Task {
    filePath: string;
    lineNumber: number;
    text: string;
    originalText: string;
    headings: string[];
    indentLevel: number;
    fileCreated: number;
    fileModified: number;
}

export interface ScanOptions {
    excludePaths?: string[] | null;
    includePaths?: string[] | null;
    excludeHeadings?: string[] | null;
}

// ============================================
// 2. Tauri IPC コマンド一覧 (#[tauri::command] 由来)
// ※ 注意: save_workspaces / save_file_content は直接 invoke せず、
//   必ず workspaceManager.ts / fileManager.ts のキュー関数を使用してください。
// ============================================

export interface TauriCommandMap {
    /** defined in src-tauri/src/file_ops.rs */
    check_file_exists: {
        args: { path: string };
        return: boolean;
    };
    /** defined in src-tauri/src/task_ops.rs */
    complete_task: {
        args: { filePath: string; lineNumber: number; originalText: string; completed?: boolean | null };
        return: void;
    };
    /** defined in src-tauri/src/file_ops.rs */
    create_new_file: {
        args: { dirPath: string; fileName: string; insertTag: string };
        return: void;
    };
    /** defined in src-tauri/src/lib.rs */
    evaluate_smart_folder: {
        args: { rules: SmartRules; workspaceNodes?: VirtualNode[] | null };
        return: VirtualNode[];
    };
    /** defined in src-tauri/src/lib.rs */
    extract_files_by_tag: {
        args: { dirPath: string; targetTag: string; includeInline: boolean };
        return: string[];
    };
    /** defined in src-tauri/src/file_ops.rs */
    find_image_file: {
        args: { dirPath: string; fileName: string };
        return: string | null;
    };
    /** defined in src-tauri/src/file_ops.rs */
    get_file_modified: {
        args: { path: string };
        return: number;
    };
    /** defined in src-tauri/src/search_ops.rs */
    get_workspace_tags: {
        args: { filePaths: string[] };
        return: Record<string, number>;
    };
    /** defined in src-tauri/src/task_ops.rs */
    get_workspace_tasks: {
        args: { filePaths: string[]; options?: ScanOptions | null };
        return: Task[];
    };
    /** defined in src-tauri/src/dashboard_ops.rs */
    load_dashboard: {
        args: { workspaceId: string };
        return: string;
    };
    /** defined in src-tauri/src/file_ops.rs */
    load_workspaces: {
        args: void;
        return: Workspace[];
    };
    /** defined in src-tauri/src/file_ops.rs */
    open_folder: {
        args: { path: string };
        return: void;
    };
    /** defined in src-tauri/src/file_ops.rs */
    read_directory: {
        args: { path: string; sortBy?: string | null; sortOrder?: string | null };
        return: VirtualNode[];
    };
    /** defined in src-tauri/src/file_ops.rs */
    read_file_content: {
        args: { path: string };
        return: string;
    };
    /** defined in src-tauri/src/file_ops.rs */
    read_image_bytes: {
        args: { path: string };
        return: number[];
    };
    /** defined in src-tauri/src/dashboard_ops.rs */
    save_dashboard: {
        args: { workspaceId: string; content: string };
        return: void;
    };
    /** defined in src-tauri/src/file_ops.rs */
    save_file_content: {
        args: { path: string; content: string; lastModified: number; force: boolean };
        return: number;
    };
    /** defined in src-tauri/src/file_ops.rs */
    save_workspaces: {
        args: { workspaces: Workspace[] };
        return: void;
    };
    /** defined in src-tauri/src/search_ops.rs */
    search_files: {
        args: { filePaths: string[]; searchByFilename: boolean; query: string };
        return: SearchResultItem[];
    };
    /** defined in src-tauri/src/lib.rs */
    show_main_window: {
        args: void;
        return: void;
    };
}

export type TauriCommandName = keyof TauriCommandMap;

/**
 * 型安全な Tauri invoke ラッパー
 */
export async function invokeCommand<K extends TauriCommandName>(
    command: K,
    ...args: TauriCommandMap[K]['args'] extends void ? [] : [args: TauriCommandMap[K]['args']]
): Promise<TauriCommandMap[K]['return']> {
    return invoke<TauriCommandMap[K]['return']>(command, args[0] as Record<string, unknown> | undefined);
}
