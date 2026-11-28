<!-- アプリのメイン画面（ガワ）。全体のデータとモーダル状態を管理。 -->

<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { open as openDialog, confirm as tauriConfirm } from '@tauri-apps/plugin-dialog';
  import { openUrl } from '@tauri-apps/plugin-opener';
  import { getCurrentWindow } from '@tauri-apps/api/window'; 
  import Editor from '../components/Editor/Editor.svelte';
  import TreeNode from '../components/TreeNode.svelte';
  import SettingsModal from '../components/Settings/SettingsModal.svelte';
  import NewFileModal from '../components/Modals/NewFileModal.svelte';
  import SmartFolderModal from '../components/Modals/SmartFolderModal.svelte';
  import WorkspaceManager from '../components/Modals/WorkspaceManager.svelte';
  import SidebarHeader from '../components/Sidebar/SidebarHeader.svelte';
  import SidebarTree from '../components/Sidebar/SidebarTree.svelte';
  import SidebarFooter from '../components/Sidebar/SidebarFooter.svelte';
  import SidebarLinks from '../components/Sidebar/SidebarLinks.svelte';
  import { activeTheme, initTheme, applyThemeToRoot } from '../lib/settings/theme';
  import { STORAGE_KEYS } from '../lib/settings/storageKeys';
  import { initStyles } from '../features/styleSettings/styleStore'; 
  import { editorFont, openTabs, activeTabId, currentWorkspaceIndex, openSearchTab, registeredTags, workspacesStore } from '../lib/stores';
  import type { UnlistenFn } from '@tauri-apps/api/event';
  import { refreshTree } from '../lib/workspace/treeUtils';
  import { isSpecialPath, isDashboardPath, getWorkspaceIdFromDashboardPath } from '../lib/utils/pathUtils';
  import { requestSaveWorkspaces, initWorkspaceSyncListener, removeNodeFromWorkspace, pinNodeToWorkspace, unpinNodeFromWorkspace, isNodePinned, getWorkspaceClickBehavior, getWorkspaceGlobalSort, setWorkspaceNodeSort, getNodePath } from '../lib/workspace/workspaceManager';
  import { setWorkspaceActions, type TreeVirtualNode } from '../lib/workspace/workspaceContext';
  import type { LinkItem, VirtualNode } from '../lib/tauri/generated';
  import { initializeWorkspaceSession } from '../lib/workspace/workspaceInit';

  let sidebarWidth = 260;
  let isResizing = false;
  function startResize() { isResizing = true; }
  function stopResize() { isResizing = false; }
  function doResize(e: MouseEvent) { if (isResizing) sidebarWidth = Math.max(150, Math.min(e.clientX, 800)); }

  let isInitialized = false; 

 $: if (isInitialized && $workspacesStore[$currentWorkspaceIndex]) {
   getCurrentWindow().setTitle($workspacesStore[$currentWorkspaceIndex].name).catch(() => {});
   $editorFont = $workspacesStore[$currentWorkspaceIndex].editor_font || 'sans-serif';
 }

  // --- メニューとモーダルの状態 ---
  let isCreateModalOpen = false, isManageModalOpen = false;
  // 💥フォルダ追加メニューとスマートフォルダ関連
  let isAddFolderMenuOpen = false, isSmartFolderModalOpen = false;
  let editingSmartNode: TreeVirtualNode | null = null;

  let editingListIndex = 0;

    // --- タグ・新規作成用の状態変数 ---
  let isNewFileModalOpen = false;
  let newFileTargetDir = '';
  let newFileCallback: (() => void) | null = null;

  function openSettings() {
      isSettingsOpen = true;
  }

  setWorkspaceActions({
    removeNode: removeNodeFromWorkspace,
    pinNode: pinNodeToWorkspace,
    unpinNode: (targetNode) => unpinNodeFromWorkspace(getNodePath(targetNode)),
    checkIsPinned: isNodePinned,
    getClickBehavior: getWorkspaceClickBehavior,
    saveWorkspace: () => requestSaveWorkspaces(true),

    // 💥 新規追加: ツリーから編集モードを呼び出す
    editSmartFolder: (node) => {
      editingSmartNode = node;
      isSmartFolderModalOpen = true;
    },
    
    openNewFileModal: (dirPath, callback) => {
      newFileTargetDir = dirPath;
      newFileCallback = callback;
      isNewFileModalOpen = true;
    },

   // 個別フォルダのソート設定用アクション
    getGlobalSort: getWorkspaceGlobalSort,
    setNodeSort: setWorkspaceNodeSort
  });

    async function handleRefresh() {
     const currentWs = $workspacesStore[$currentWorkspaceIndex];
   if (!currentWs) return;
   
   // 最新のツリー情報を取得
   const refreshedMainNodes = await refreshTree(currentWs.nodes, currentWs.nodes);
   const linkedLibs = currentWs.linked_libraries || [];
   const libUpdates: Array<{ index: number; nodes: VirtualNode[] }> = [];
   
    if (linkedLibs && linkedLibs.length > 0) {
      for (const libId of linkedLibs) {
        const libIndex = $workspacesStore.findIndex(w => w.id === libId);
        if (libIndex !== -1) {
           const refreshedLibNodes = await refreshTree($workspacesStore[libIndex].nodes, $workspacesStore[libIndex].nodes);
          libUpdates.push({ index: libIndex, nodes: refreshedLibNodes });
        }
      }
    }
    
   // 取得したデータをStoreに一括反映
   workspacesStore.update(wsList => {
     if (wsList[$currentWorkspaceIndex]) {
       wsList[$currentWorkspaceIndex].nodes = refreshedMainNodes;
     }
     for (const update of libUpdates) {
       wsList[update.index].nodes = update.nodes;
     }
     return wsList;
   });

    await requestSaveWorkspaces();
  }
  let unlistenWorkspaceSync: UnlistenFn | null = null;

  onMount(async () => {
    try {
      const savedTags = localStorage.getItem(STORAGE_KEYS.REGISTERED_TAGS);
      if (savedTags) registeredTags.set(JSON.parse(savedTags));
    } catch (e) {
      console.error('登録済みタグの復元に失敗しました:', e);
    }

    initTheme();
    initStyles(); 

    try {
      unlistenWorkspaceSync = await initWorkspaceSyncListener();

     // ワークスペース読み込み、タブ復元、ツリー同期を実行
      await initializeWorkspaceSession(window.location.search);

      // この時点で画面をユーザーに見せる
      isInitialized = true; 

      // 初期化が終わったこのタイミングでメイン画面をパッと表示する
      await invoke('show_main_window');
      
    } catch (e) {
      console.error("Initialization failed:", e);
    }
  });

  onDestroy(() => {
    unlistenWorkspaceSync?.();
  });




  async function deleteLink(id: string) {
       workspacesStore.update(wsList => {
     if (wsList[$currentWorkspaceIndex]) {
       wsList[$currentWorkspaceIndex].links = (wsList[$currentWorkspaceIndex].links || []).filter((l: LinkItem) => l.id !== id);
     }
     return wsList;
   });
    await requestSaveWorkspaces();
  }

let isSettingsOpen = false;

  // 💥 移動したCSS変数の適用処理を呼び出す
  $: if (typeof document !== 'undefined' && $activeTheme) {
    applyThemeToRoot($activeTheme);
  }

</script>


<svelte:window on:mousemove={doResize} on:mouseup={stopResize} />

<main class="h-screen w-screen flex select-none transition-colors duration-200"
      style="background-color: var(--bg-color); color: var(--text-color);">
  
  <div class="flex flex-col border-r" 
        style="width: {sidebarWidth}px; background-color: var(--bg-color); border-color: color-mix(in srgb, var(--text-color) 10%, transparent);">

    <SidebarHeader
      on:refresh={handleRefresh}
      on:addNode={(e) => {
         workspacesStore.update(ws => {
         if (ws[$currentWorkspaceIndex]) {
           ws[$currentWorkspaceIndex].nodes = [...(ws[$currentWorkspaceIndex].nodes || []), e.detail];
         }
         return ws;
       });
        requestSaveWorkspaces(true);
      }}
      on:openSmartFolder={() => {
        editingSmartNode = null;
        isSmartFolderModalOpen = true;
      }}
    />
    
    <SidebarTree />

    <!-- リンク固定エリア -->
     {#if $workspacesStore[$currentWorkspaceIndex]}
      <SidebarLinks 
        links={$workspacesStore[$currentWorkspaceIndex].links || []} 
        onLinkDelete={deleteLink} 
      />
    {/if}

    <!-- UI下部 -->
   <SidebarFooter 
      bind:editingListIndex
      bind:isCreateModalOpen
      bind:isManageModalOpen
      {openSettings}
    />
  </div>

   <!-- リサイズバー（Obsidian風: 広い当たり判定 + ホバー時に太くなるアニメーション） -->
   <div class="relative w-2 -mx-1 flex items-center justify-center cursor-col-resize z-10 group" 
        on:mousedown={startResize}>
     <div class="h-full w-[1px] bg-[color-mix(in_srgb,var(--text-color)_5%,transparent)] transition-all duration-20 group-hover:w-[3px] group-hover:bg-[var(--accent-color)]"></div>
   </div>
  <div class="flex-1 overflow-hidden relative">
    {#if isResizing}<div class="absolute inset-0 z-50 cursor-col-resize"></div>{/if}
    <Editor />
  </div>
</main>

<!-- 💥 各種モーダル -->

<WorkspaceManager
  bind:editingListIndex
  bind:isCreateModalOpen
  bind:isManageModalOpen
/>

{#if isSettingsOpen}
  <SettingsModal on:close={() => isSettingsOpen = false} />
{/if}
<!-- 💥 新規ファイル作成モーダル -->
<NewFileModal 
  bind:isOpen={isNewFileModalOpen} 
  targetDir={newFileTargetDir} 
  on:success={() => {
    if (newFileCallback) newFileCallback();
  }} 
/>

<!-- 💥 条件で抽出（スマートフォルダ）モーダル -->
<!-- 子から抽出完了(save)の知らせが来たら、親が責任を持ってツリーに組み込んで保存します -->
<SmartFolderModal
  bind:isOpen={isSmartFolderModalOpen}
  editingSmartNode={editingSmartNode}
  workspaceNodes={$workspacesStore[$currentWorkspaceIndex]?.nodes || []}
  on:save={(e) => {
    const { name, rules, children } = e.detail;
    workspacesStore.update(wsList => {
    const currentWs = wsList[$currentWorkspaceIndex];
      if (!currentWs) return wsList;

    if (editingSmartNode && editingSmartNode.type === 'Folder') {
      editingSmartNode.name = name;
      editingSmartNode.smart_rules = rules;
      editingSmartNode.children = children;
    } else {
      const newNode: VirtualNode = { type: "Folder", name, original_path: rules.target_dir || "__workspace__", children, smart_rules: rules };
      currentWs.nodes = [...(currentWs.nodes || []), newNode];
    }
     return wsList;
   });
    requestSaveWorkspaces(true);
  }}
/>