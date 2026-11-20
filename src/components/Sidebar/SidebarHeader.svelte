<!-- サイドバー上部の新規追加ボタン等-->
<!-- --- START OF src/components/Sidebar/SidebarHeader.svelte --- -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { open as openDialog } from '@tauri-apps/plugin-dialog';
  import { RotateCw, ArrowUpDown, Search, FolderPlus, FilePlus, ListTodo, LayoutDashboard } from 'lucide-svelte';
  import { openSearchTab, openTaskTab, openDashboardTab, workspacesStore, currentWorkspaceIndex } from '../../lib/stores';
  import type { VirtualNode } from '../../lib/tauri/generated';
  import { requestSaveWorkspaces } from '../../lib/workspace/workspaceManager';


  const dispatch = createEventDispatcher();

  // メニューの開閉状態（この部品の中だけで完結する）
  let isGlobalSortMenuOpen = false;
  let isAddFolderMenuOpen = false;

  // ウィンドウ外をクリックした時にメニューを閉じる
  function closeMenus() {
    isGlobalSortMenuOpen = false;
    isAddFolderMenuOpen = false;
  }

  // --- ソート変更処理 ---
  async function changeGlobalSort(type: 'by' | 'order', value: string) {
    workspacesStore.update(ws => {
      const current = ws[$currentWorkspaceIndex];
      if (current) {
        if (type === 'by') current.sort_by = value;
        else current.sort_order = value;
      }
      return ws;
    });
    await requestSaveWorkspaces(true);
  }

  // --- フォルダ・ファイル追加処理 ---
  async function addFolder() {
    isAddFolderMenuOpen = false;
    const selectedPath = await openDialog({ directory: true, multiple: false });
    if (typeof selectedPath === 'string') {
      const newNode: VirtualNode = { type: "Folder", name: selectedPath.split(/[/\\]/).pop() || '新規フォルダ', original_path: selectedPath, children: [] };
      dispatch('addNode', newNode);
    }
  }

  async function addFile() {
    isAddFolderMenuOpen = false;
    const selectedPath = await openDialog({ directory: false, multiple: false });
    if (typeof selectedPath === 'string') {
      const newNode: VirtualNode = { type: "File", name: selectedPath.split(/[/\\]/).pop() || '新規ファイル', path: selectedPath, created: 0, modified: 0 };
      dispatch('addNode', newNode);
    }
  }

  // スマートフォルダ（抽出）モーダルを開くよう親に依頼
  function openSmartFolderModal() {
    isAddFolderMenuOpen = false;
    dispatch('openSmartFolder');
  }
</script>

<svelte:window on:click={closeMenus} />

<div class="p-3 border-b font-bold flex justify-between items-center shrink-0" style="border-color: color-mix(in srgb, var(--text-color) 10%, transparent);">

    <!-- 左寄せメニュー -->
  <div class="relative flex items-center shrink-0">
    <button on:click|stopPropagation={() => isAddFolderMenuOpen = !isAddFolderMenuOpen} class="flex items-center justify-center w-6 h-6 hover:opacity-70 rounded transition" title="追加メニュー">
      <FolderPlus size={14} />
    </button>
    
    {#if isAddFolderMenuOpen}
      <div class="absolute top-8 left-0 border rounded shadow-xl z-50 py-1 w-40 text-sm font-normal" style="background-color: var(--menu-bg); color: var(--text-color); border-color: color-mix(in srgb, var(--text-color) 20%, transparent);">
        <button class="flex items-center w-full text-left px-4 py-2 hover:opacity-70 transition" on:click={openSmartFolderModal}><Search size={14} class="mr-2" /> フォルダを追加</button>
        <button class="flex items-center w-full text-left px-4 py-2 hover:opacity-70 transition" on:click={addFile}><FilePlus size={14} class="mr-2" /> ファイルを追加</button>
      </div>
    {/if}
  </div>
   
  <!-- 右寄せボタングループ -->

  <div class="flex gap-2 shrink-0 relative">
    
    <!-- 更新ボタン（親に処理を依頼） -->
    <button on:click={() => dispatch('refresh')} class="flex items-center justify-center w-6 h-6 hover:opacity-70 rounded transition" title="更新">
      <RotateCw size={14} />
    </button>

    <!-- ソートメニュー -->
    <div class="relative flex items-center">
      <button on:click|stopPropagation={() => isGlobalSortMenuOpen = !isGlobalSortMenuOpen} class="flex items-center justify-center w-6 h-6 hover:opacity-70 rounded transition" title="並び替え">
        <ArrowUpDown size={14} />
      </button>
      
      {#if isGlobalSortMenuOpen}
        <div class="absolute top-8 left-0 border rounded shadow-xl z-50 py-1 w-32 text-sm font-normal" style="background-color: var(--menu-bg); color: var(--text-color); border-color: color-mix(in srgb, var(--text-color) 20%, transparent);">
          <button class="block w-full text-left px-4 py-1.5 hover:opacity-70 transition" on:click={() => changeGlobalSort('order', 'asc')}>
            <span class="inline-block w-4">{$workspacesStore[$currentWorkspaceIndex]?.sort_order !== 'desc' ? '✓' : ''}</span>昇順
          </button>
          <button class="block w-full text-left px-4 py-1.5 hover:opacity-70 transition" on:click={() => changeGlobalSort('order', 'desc')}>
            <span class="inline-block w-4">{$workspacesStore[$currentWorkspaceIndex]?.sort_order === 'desc' ? '✓' : ''}</span>降順
          </button>
          <hr class="my-1" style="border-color: color-mix(in srgb, var(--text-color) 10%, transparent);">
          <button class="block w-full text-left px-4 py-1.5 hover:opacity-70 transition" on:click={() => changeGlobalSort('by', 'name')}>
            <span class="inline-block w-4">{$workspacesStore[$currentWorkspaceIndex]?.sort_by === 'name' || !$workspacesStore[$currentWorkspaceIndex]?.sort_by ? '✓' : ''}</span>名前
          </button>
          <button class="block w-full text-left px-4 py-1.5 hover:opacity-70 transition" on:click={() => changeGlobalSort('by', 'created')}>
            <span class="inline-block w-4">{$workspacesStore[$currentWorkspaceIndex]?.sort_by === 'created' ? '✓' : ''}</span>作成日
          </button>
          <button class="block w-full text-left px-4 py-1.5 hover:opacity-70 transition" on:click={() => changeGlobalSort('by', 'modified')}>
            <span class="inline-block w-4">{$workspacesStore[$currentWorkspaceIndex]?.sort_by === 'modified' ? '✓' : ''}</span>更新日
          </button>
        </div>
      {/if}
    </div>
    
    <!-- 検索ボタン（ストアの関数を直接呼ぶ） -->
    <button on:click={openSearchTab} class="flex items-center justify-center w-6 h-6 hover:opacity-70 rounded transition" title="検索">
      <Search size={14} />
    </button>
    

     <!-- タスク一覧ボタン（ストアの関数を直接呼ぶ） -->
     <button on:click={openTaskTab} class="flex items-center justify-center w-6 h-6 hover:opacity-70 rounded transition" title="タスク一覧">
       <ListTodo size={14} />
     </button>

     
    <!-- ダッシュボードボタン -->
    {#if $workspacesStore.length > 0 && $workspacesStore[$currentWorkspaceIndex]}
      <button 
        on:click={() => openDashboardTab($workspacesStore[$currentWorkspaceIndex].id, $workspacesStore[$currentWorkspaceIndex].name)} 
        class="flex items-center justify-center w-6 h-6 hover:opacity-70 rounded transition" 
        title="ダッシュボード">
        <LayoutDashboard size={14} />
      </button>
    {/if}

  </div>
</div>
<!-- --- END OF src/components/Sidebar/SidebarHeader.svelte --- -->
