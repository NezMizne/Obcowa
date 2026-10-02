<!-- サイドバー下部のリスト切り替え・設定ボタン -->

<script lang="ts">
  import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
  import { SquarePen, Settings, SlidersHorizontal, ChevronDown, ChevronUp } from 'lucide-svelte';
  import { workspacesStore, currentWorkspaceIndex } from '../../lib/stores';

  // 親から受け取る変数（モーダル開閉フラグなどは双方向バインディングで親と共有します）
  export let editingListIndex: number;
  export let isCreateModalOpen: boolean;
  export let isManageModalOpen: boolean;
  export let openSettings: () => void;

  // メニューの開閉状態はここで自己管理する
  let isSettingsMenuOpen = false;
  // ワークスペース選択メニューの開閉状態とキーボード選択位置
  let isWorkspaceMenuOpen = false;
  let focusedIndex = 0; 

  // 選択可能なワークスペース一覧を計算しておく
  $: activeWorkspaces = $workspacesStore.map((w, i) => ({...w, originalIndex: i})).filter(w => w.category === 'Active');

  // 引数を直接の Index 番号に変更
  function changeWorkspace(selectedIndex: number) {
    isWorkspaceMenuOpen = false;
    if (selectedIndex === $currentWorkspaceIndex) return;

    // 別のワークスペースを「新しいウィンドウ」として開く
    const label = `ws-${Date.now()}`;
    const webview = new WebviewWindow(label, {
      url: `/?ws=${selectedIndex}`,
      title: $workspacesStore[selectedIndex]?.name || 'Workspace',
      width: 1000,
      height: 800
    });

    webview.once('tauri://error', function (e) {
      console.error('ウィンドウ生成エラー:', e);
      alert('新しいウィンドウを開けませんでした。パーミッション設定を確認してください。');
    });
  }
  
  // 💥 追加: カスタムドロップダウンのキーボード操作ハンドラ
  function handleSelectKeydown(e: KeyboardEvent) {
    if (!isWorkspaceMenuOpen) {
      // メニューが閉じている時に Enter, Space, または矢印キーで展開
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        isWorkspaceMenuOpen = true;
        // 開いた瞬間、現在のワークスペースにフォーカスを合わせる
        focusedIndex = activeWorkspaces.findIndex(ws => ws.originalIndex === $currentWorkspaceIndex);
        if (focusedIndex === -1) focusedIndex = 0;
      }
      return;
    }

    // メニュー展開中のキー操作
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      focusedIndex = (focusedIndex + 1) % activeWorkspaces.length;
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      focusedIndex = (focusedIndex - 1 + activeWorkspaces.length) % activeWorkspaces.length;
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      changeWorkspace(activeWorkspaces[focusedIndex].originalIndex);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      isWorkspaceMenuOpen = false;
    }
  }
</script>

<!-- 画面のどこかをクリックしたらメニューを閉じる処理（この部品限定） -->
<svelte:window on:click={() => { isSettingsMenuOpen = false; isWorkspaceMenuOpen = false; }} />

<div 
  class="p-2 border-t flex items-center gap-1 relative" 
  style="background-color: var(--menu-bg); border-color: color-mix(in srgb, var(--text-color) 10%, transparent);"
>

  <!-- 💥 変更: 標準の <select> をやめ、カスタムのボタンとポップアップメニューに変更 -->
  <div class="relative">
    <button 
      class="w-32 text-xs rounded py-1 px-2 text-left outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent-color)] focus-visible:-outline-offset-2 flex justify-between items-center transition-colors" 
      style="background-color: var(--bg-color); color: var(--text-color);" 
      on:click|stopPropagation={() => { isWorkspaceMenuOpen = !isWorkspaceMenuOpen; focusedIndex = activeWorkspaces.findIndex(ws => ws.originalIndex === $currentWorkspaceIndex); }}
      on:keydown={handleSelectKeydown}
    >
      <span class="truncate">{$workspacesStore[$currentWorkspaceIndex]?.name || 'Workspace'}</span>
      {#if isWorkspaceMenuOpen}<ChevronUp size={12} class="opacity-70 shrink-0" />{:else}<ChevronDown size={12} class="opacity-70 shrink-0" />
{/if}
    </button>

    {#if isWorkspaceMenuOpen}
      <div 
        class="absolute bottom-full left-0 mb-1 border rounded shadow-xl z-50 py-1 w-44 text-sm max-h-48 overflow-y-auto" 
        style="background-color: var(--menu-bg); color: var(--text-color); border-color: color-mix(in srgb, var(--text-color) 20%, transparent);"
      >
        {#each activeWorkspaces as ws, i}
          <button 
            class="menu-item" 
            style={focusedIndex === i ? 'background-color: var(--active-highlight-bg);' : ''}
            on:click|stopPropagation={() => changeWorkspace(ws.originalIndex)}
            on:mouseenter={() => focusedIndex = i}
          >
            {ws.name}
          </button>
        {/each}
      </div>
    {/if}
  </div>
  
  <div class="flex-1"></div>

  <button 
    on:click|stopPropagation={() => isSettingsMenuOpen = !isSettingsMenuOpen} 
    class="flex items-center justify-center w-7 h-7 opacity-70 hover:opacity-100 transition relative z-10 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent-color)] focus-visible:-outline-offset-2"
  >
    <Settings size={16} />
  </button>
  

  {#if isSettingsMenuOpen}
  
    <div 
      class="absolute bottom-10 right-2 border rounded shadow-xl z-50 py-1 w-44 text-sm" 
      style="background-color: var(--menu-bg); color: var(--text-color); border-color: color-mix(in srgb, var(--text-color) 20%, transparent);"
    >
      <button class="menu-item" on:click={() => { isSettingsMenuOpen = false; isCreateModalOpen = true; }}>

        <SquarePen size={14} class="mr-2" /> リスト作成
      </button>

      <button class="menu-item" on:click={() => { isSettingsMenuOpen = false; editingListIndex = $currentWorkspaceIndex; isManageModalOpen = true; }}>

        <SlidersHorizontal size={14} class="mr-2" /> リスト管理
      </button>

      <div class="border-t my-1" style="border-color: color-mix(in srgb, var(--text-color) 10%, transparent);"></div>
      <button class="menu-item" on:click={() => { isSettingsMenuOpen = false; openSettings(); }}>

        <Settings size={14} class="mr-2" /> 設定
      </button>
    </div>
  {/if}
</div>


<style>
  .menu-item {
    display: flex;
    align-items: center;
    width: 100%;
    text-align: left;
    padding: 0.5rem 1rem;
    transition: background-color 0.15s ease;
    color: var(--text-color);
  }

  /* 💥 変更: マウスホバー時だけでなく、Tabキーでのフォーカス時も背景をハイライトする */
  .menu-item:hover,
  .menu-item:focus-visible {
    background-color: var(--active-highlight-bg);
    outline: none;
  }
</style>