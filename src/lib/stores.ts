//Svelte Store（タブの状態、ワークスペース一覧などをグローバル管理）

import { writable, get } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';
import type { Workspace, SavedTab, SearchResultItem } from './tauri/generated';
import { requestSaveWorkspaces } from './workspace/workspaceManager';

export interface TabData {
    id: string;      // タブごとのユニークなID
    path: string;    // ファイルの実際のパス
    title: string;
    content: string;
    isEditing: boolean;
    isDirty: boolean;
    lastModified?: number; // ファイルの最終更新日時
    isConflict?: boolean; // 競合発生中で保留しているかどうかのフラグ
    isDashboard?: boolean; // ダッシュボードかどうかの判定フラグ
    workspaceId?: string;  // 保存時にバックエンドへ送るためのID
}

export const workspacesStore = writable<Workspace[]>([]);
export const openTabs = writable<TabData[]>([]);
export const activeTabId = writable<string | null>(null);

export const editorFont = writable<string>('sans-serif'); 
export const currentWorkspaceIndex = writable<number>(0);

export const registeredTags = writable<string[]>([]);

// 検索タブの状態を保持するためのストア
export const searchState = writable({
    query: '',

    searchByFilename: false, // 先ほど追加したファイル名検索フラグ
    results: [] as SearchResultItem[],
    hasSearched: false,
    sortKey: 'updated',
    sortOrder: 'desc',
    autoRunSearch: false, // 追加: 検索タブを開いた時に自動で検索を走らせるためのフラグ

});

// 左メニュー（ツリー）のフォルダを自動展開するためのリクエスト保持ストア
// （同じファイルを連続でダブルクリックしても反応するように、タイムスタンプを含めます）
export const expandTreeRequest = writable<{ path: string; timestamp: number } | null>(null);


 /**
  * 💥 追加: 現在のタブの状態をワークスペースの設定に同期して保存する内部関数
  */
 function syncTabsToWorkspace() {
   const currentWsIndex = get(currentWorkspaceIndex);
   const wsList = get(workspacesStore);
   
   if (wsList.length === 0 || !wsList[currentWsIndex]) return;
 
   const tabsToSave: SavedTab[] = get(openTabs).map(t => ({ 
     id: t.id, 
     path: t.path, 
     title: t.title, 
     isEditing: t.isEditing 
   }));
 
   workspacesStore.update(ws => {
     ws[currentWsIndex].saved_tabs = tabsToSave;
     ws[currentWsIndex].active_tab_id = get(activeTabId);
     return ws;
   });
 
   requestSaveWorkspaces();
 }

// 💥 検索用の特殊なタブを作成・表示する関数
export function openSearchTab() {
    const newId = "search-tab";
    openTabs.update(tabs => {
        const resetTabs = tabs.map(t => ({ ...t, isEditing: false }));
        // 既に検索タブがあればそれを表示
        if (resetTabs.some(t => t.id === newId)) return resetTabs;
        // なければ作成
        return [...resetTabs, {
            id: newId,
            path: "__SEARCH__", // 検索タブと識別するための特殊パス
            title: "検索",
            content: "",
            isEditing: false,
            isDirty: false,
            lastModified: 0 
        }];
    });
    activeTabId.set(newId);
    syncTabsToWorkspace();
}

 // 💥 タスク一覧用の特殊なタブを作成・表示する関数
 export function openTaskTab() {
     const newId = "task-tab";
     openTabs.update(tabs => {
         const resetTabs = tabs.map(t => ({ ...t, isEditing: false }));
         // 既にタスクタブがあればそれを表示
         if (resetTabs.some(t => t.id === newId)) return resetTabs;
         // なければ作成
         return [...resetTabs, {
             id: newId,
             path: "__TASK__", // タスクタブと識別するための特殊パス
             title: "タスク一覧",
             content: "",
             isEditing: false,
             isDirty: false,
             lastModified: 0 
         }];
     });
     activeTabId.set(newId);
     syncTabsToWorkspace();
 }

// 💥 タブを切り替えるときに、すべてのタブをビューモード（isEditing = false）に戻す
export function switchTab(tabId: string) {
    openTabs.update(tabs => tabs.map(t => ({ ...t, isEditing: false })));
    activeTabId.set(tabId);
    syncTabsToWorkspace();
}

// 左クリック：今のタブを上書き
export function openFileInCurrentTab(filePath: string, title: string, initialContent: string) {
    const tabs = get(openTabs);
    const currentId = get(activeTabId);
    
    // 全てをビューモードにリセットした配列を作る
    const resetTabs = tabs.map(t => ({ ...t, isEditing: false }));

    if (currentId && resetTabs.length > 0) {
        openTabs.set(resetTabs.map(tab => 
            tab.id === currentId 
                ? { ...tab, path: filePath, title, content: initialContent, isDirty: false }
                : tab
        ));
    } else {
        openFileInNewTab(filePath, title, initialContent);
    }
    syncTabsToWorkspace();
}

// 右クリック：新しいタブ（同じファイルでも気にせず新規作成）
export function openFileInNewTab(filePath: string, title: string, initialContent: string) {
    const newId = "tab-" + Date.now() + Math.random();
    openTabs.update(tabs => {
        const resetTabs = tabs.map(t => ({ ...t, isEditing: false }));
        return [...resetTabs, {
            id: newId,
            path: filePath,
            title,
            content: initialContent,
            isEditing: false,
            isDirty: false,
            lastModified: 0
        }];
    });
    activeTabId.set(newId);
    syncTabsToWorkspace();
}

export function createNewTab() {
    const newId = "new-" + Date.now();
    openTabs.update(tabs => {
        const resetTabs = tabs.map(t => ({ ...t, isEditing: false }));
        return [...resetTabs, { 
            id: newId, 
            path: "", 
            title: "無題のファイル", 
            content: "", 
            isEditing: true, 
            isDirty: true,
            lastModified: 0
        }];
    });
    activeTabId.set(newId);
    syncTabsToWorkspace();
}

export function closeTab(idToClose: string) {
    openTabs.update(tabs => {
        const filtered = tabs.filter(t => t.id !== idToClose);
        activeTabId.update(current => {
            if (current === idToClose) {
                return filtered.length > 0 ? filtered[filtered.length - 1].id : null;
            }
            return current;
        });
        return filtered;
    });
    syncTabsToWorkspace();
}

//  ランチャー（ワークスペース一覧）を起動時に開くかどうかの設定
export const showLauncherOnStartup = writable<boolean>(false);

export async function openDashboardTab(workspaceId: string, workspaceName: string) {
    const dashboardTabId = `dashboard-${workspaceId}`;
    const tabs = get(openTabs);

    // すでにダッシュボードが開いている場合は、そのタブをアクティブにするだけ（競合防止）
    if (tabs.some(tab => tab.id === dashboardTabId)) {
        switchTab(dashboardTabId);
        return;
    }

    try {
        // Tauriからダッシュボードの内容を読み込む
        const content = await invoke<string>('load_dashboard', { workspaceId });
        
        const newTab: TabData = {
            id: dashboardTabId,
            title: `Dashboard: ${workspaceName}`,
            content: content,
            isDirty: false, // isUnsaved ではなく isDirty
            isEditing: false, 
            path: `__DASHBOARD__${workspaceId}`, // filePath ではなく path。他と被らない名前
            lastModified: Date.now(),
            isDashboard: true,
            workspaceId: workspaceId
        };

        openTabs.update(t => [...t, newTab]);
        activeTabId.set(newTab.id);
        syncTabsToWorkspace();
    } catch (error) {
        console.error("Failed to load dashboard:", error);
        // エラーハンドリングが必要ならここに追記
    }
}