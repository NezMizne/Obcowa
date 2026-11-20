// 責務: アプリ起動時におけるワークスペースの読み込み、タブ復元、初期バックグラウンド同期
import { invoke } from '@tauri-apps/api/core';
import type { SavedTab, Workspace } from '../tauri/generated';
import { workspacesStore, currentWorkspaceIndex, openTabs, activeTabId, searchState, type TabData } from '../stores';
import { isSpecialPath, isDashboardPath, getWorkspaceIdFromDashboardPath } from '../utils/pathUtils';
import { refreshTree } from './treeUtils';
import { createDefaultWorkspace } from './workspaceManager';

/**
 * 保存されていたタブ情報を元に、各ファイル/ダッシュボードの内容を読み込んでTabData配列を復元します。
 */
export async function restoreTabs(savedTabs: SavedTab[]): Promise<TabData[]> {
  const restored: TabData[] = [];

  for (const tab of savedTabs) {
    let content = "";
    let isDashboard = false;
    let workspaceId = "";

    if (tab.path) {
      if (isDashboardPath(tab.path)) {
        isDashboard = true;
        workspaceId = getWorkspaceIdFromDashboardPath(tab.path) || '';
        try {
          content = await invoke('load_dashboard', { workspaceId });
        } catch (e) {
          console.error("Failed to restore dashboard content:", e);
        }
      } else if (!isSpecialPath(tab.path)) {
        try {
          content = await invoke('read_file_content', { path: tab.path });
        } catch (e) {
          console.error(`Failed to read file content: ${tab.path}`, e);
        }
      }
    }

    restored.push({
      id: tab.id,
      path: tab.path || '',
      title: tab.title,
      content,
      isEditing: tab.isEditing ?? false,
      isDirty: false,
      lastModified: 0,
      isDashboard,
      workspaceId
    });
  }

  return restored;
}

/**
 * 起動時のワークスペース読み込み、タブの即時復元、バックグラウンドでのツリー更新を行います。
 */
export async function initializeWorkspaceSession(searchQuery: string): Promise<void> {
  let loadedWorkspaces = await invoke<Workspace[]>('load_workspaces');

  // 初期ワークスペースのフォールバック
  if (loadedWorkspaces.length === 0) {
    loadedWorkspaces = [
      createDefaultWorkspace({
        id: Date.now().toString(),
        name: '作業中',
        category: 'Active',
      })
    ];
  }

  // URLパラメータ(?ws=0など)または最初のアクティブワークスペースから初期インデックスを決定
  let startWsIndex = 0;
  const params = new URLSearchParams(searchQuery);
  const wsParam = params.get('ws');
  if (wsParam !== null) {
    startWsIndex = parseInt(wsParam, 10);
  } else {
    const firstActive = loadedWorkspaces.findIndex((w) => w.category === 'Active');
    if (firstActive !== -1) startWsIndex = firstActive;
  }

  // グローバルストアに初期データをセット
  workspacesStore.set(loadedWorkspaces);
  currentWorkspaceIndex.set(startWsIndex);

  // ツリー最新化を待たずに、保存されていたタブと検索ソート設定を即時復元
  const ws = loadedWorkspaces[startWsIndex];
  if (ws) {
    searchState.update(s => ({
      ...s,
      sortKey: ws.search_sort_by || 'updated',
      sortOrder: ws.search_sort_order || 'desc'
    }));

    if (ws.saved_tabs && ws.saved_tabs.length > 0) {
      const restoredTabs = await restoreTabs(ws.saved_tabs);
      openTabs.set(restoredTabs);
      activeTabId.set(ws.active_tab_id || (restoredTabs[0] ? restoredTabs[0].id : null));
    }
  }

  // バックグラウンドでツリーを最新化
  (async () => {
    try {
      const updatedList = [...loadedWorkspaces];
      for (let i = 0; i < updatedList.length; i++) {
        updatedList[i].nodes = await refreshTree(updatedList[i].nodes, updatedList[i].nodes);
      }
      workspacesStore.set(updatedList);
    } catch (e) {
      console.error("Failed to background refresh tree:", e);
    }
  })();
}