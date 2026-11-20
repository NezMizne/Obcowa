<!-- --- START OF src/components/Modals/WorkspaceManager.svelte --- -->
<script lang="ts">
  import { createEventDispatcher, tick } from 'svelte';
  import { confirm as tauriConfirm } from '@tauri-apps/plugin-dialog';
  import { openTabs, activeTabId, workspacesStore, currentWorkspaceIndex } from '../../lib/stores';
  import type { LinkItem } from '../../lib/tauri/generated';
  import { createDefaultWorkspace, requestSaveWorkspaces } from '../../lib/workspace/workspaceManager';

  export let editingListIndex: number;
  
  export let isCreateModalOpen = false;
  export let isManageModalOpen = false;

  // --- リスト作成・管理関連 ---
  let newListName = '';

  async function createNewWorkspace() {
    if (!newListName) return;

    workspacesStore.update(ws => [
      ...ws, 
      createDefaultWorkspace({
        id: Date.now().toString(),
        name: newListName,
        category: 'Active',
      })
    ]);

    openTabs.set([]);
    activeTabId.set(null);

    $currentWorkspaceIndex = $workspacesStore.length - 1;
    isCreateModalOpen = false; 
    newListName = '';
    await requestSaveWorkspaces(true);
  }


  async function deleteEditingList() {
    const isYes = await tauriConfirm("本当に削除しますか？", { title: "確認", kind: "warning" });
    if (isYes) {
      workspacesStore.update(ws => {
        const newWs = [...ws];
        newWs.splice(editingListIndex, 1);
        return newWs;
      });

      if ($currentWorkspaceIndex >= $workspacesStore.length) {
        $currentWorkspaceIndex = Math.max(0, $workspacesStore.length - 1);
      }
      isManageModalOpen = false;
      
      await requestSaveWorkspaces(true);
    }
  }

  async function triggerSave() { 
    // DOM/Storeへの値の反映を確実に待ってから保存する
    await tick();
    await requestSaveWorkspaces(true); 
  }

  // --- リンク機能関連 ---
  let isLinkModalOpen = false, editingLinkId: string | null = null, linkTitle = '', linkUrl = '';
  let linkContextMenu = { show: false, x: 0, y: 0, link: null as LinkItem | null };

  function openLinkModal(linkToEdit?: LinkItem) {
    if (linkToEdit) { editingLinkId = linkToEdit.id; linkTitle = linkToEdit.title; linkUrl = linkToEdit.url; } 
    else { editingLinkId = null; linkTitle = ''; linkUrl = ''; }
    isLinkModalOpen = true;
  }

  async function saveLink() {
    if (!linkTitle || !linkUrl) return;
    if (!linkUrl.startsWith('http')) linkUrl = 'https://' + linkUrl;

    workspacesStore.update(ws => {
      const targetWs = ws[editingListIndex];
      if (!targetWs.links) targetWs.links = [];
      if (editingLinkId) {
        const idx = targetWs.links.findIndex((l) => l.id === editingLinkId);
        if (idx !== -1) targetWs.links[idx] = { id: editingLinkId, title: linkTitle, url: linkUrl };
      } else { 
        targetWs.links.push({ id: Date.now().toString(), title: linkTitle, url: linkUrl }); 
      }
      return ws;
    });

    isLinkModalOpen = false;
    await requestSaveWorkspaces(true);
  }

  async function deleteLink(id: string) {
    workspacesStore.update(ws => {
      const targetWs = ws[editingListIndex];
      if (targetWs && targetWs.links) {
        targetWs.links = targetWs.links.filter((l) => l.id !== id);
      }
      return ws;
    });
    await requestSaveWorkspaces(true);
    closeLinkMenu();
  }

  function handleLinkContextMenu(e: MouseEvent, link: LinkItem) { e.preventDefault(); linkContextMenu = { show: true, x: e.clientX, y: e.clientY, link }; }
  function closeLinkMenu() { linkContextMenu.show = false; }
</script>

<!-- 1. リスト作成 -->
{#if isCreateModalOpen}
  <div class="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center">
    <div class="p-6 rounded shadow-lg border border-black/20 w-96" style="background-color: var(--menu-bg); color: var(--text-color);">
      <h2 class="text-lg font-bold mb-4">ワークスペースを作成</h2>
      <input type="text" class="w-full bg-black/10 border border-black/20 rounded p-2 text-sm outline-none mb-6" bind:value={newListName} placeholder="新しい名前" on:keydown={(e) => e.key === 'Enter' && createNewWorkspace()} />
      <div class="flex justify-end gap-2">
        <button class="px-4 py-2 bg-black/10 hover:bg-black/20 rounded text-sm transition" on:click={() => isCreateModalOpen = false}>キャンセル</button>
        <button class="px-4 py-2 bg-[var(--accent-color)] text-white hover:brightness-110 rounded text-sm shadow transition" on:click={createNewWorkspace}>作成</button>
      </div>
    </div>
  </div>
{/if}

<!-- 2. リスト管理 -->
{#if isManageModalOpen}
  <div class="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center">
    <div class="p-6 rounded shadow-lg border border-black/20 w-[500px]" style="background-color: var(--menu-bg); color: var(--text-color);">
      <h2 class="text-lg font-bold mb-4">リスト管理</h2>
      <div class="flex gap-2 mb-4">
        <select class="flex-1 bg-black/10 border border-black/20 rounded p-2 text-sm outline-none" style="background-color: var(--bg-color); color: var(--text-color);" bind:value={editingListIndex}>
          <optgroup label="ワークスペース">{#each $workspacesStore.map((w, i) => ({...w, i})).filter(w => w.category === 'Active') as ws}<option value={ws.i}>{ws.name}</option>{/each}</optgroup>
          
        </select>
        <button on:click={deleteEditingList} class="px-3 py-2 bg-red-900/50 hover:bg-red-900/80 text-red-100 rounded text-sm transition font-bold">削除</button>
      </div>

     {#if $workspacesStore[editingListIndex]}
        <div class="bg-black/5 p-4 rounded border border-black/10 mb-6 max-h-[50vh] overflow-y-auto">
          <input type="text" class="w-full bg-black/10 border border-black/20 rounded p-2 text-sm outline-none mb-4" bind:value={$workspacesStore[editingListIndex].name} on:change={triggerSave} />
          
          {#if $workspacesStore[editingListIndex].category === 'Active'}
            <div class="mb-4 p-3 bg-black/5 rounded border border-black/10">
              <div class="text-xs opacity-70 mb-2">ファイルをクリックした時の動作</div>
              <label class="flex items-center text-sm cursor-pointer mb-2">
                <input type="radio" bind:group={$workspacesStore[editingListIndex].open_in_new_tab} value={false} on:change={triggerSave} class="mr-2 accent-[var(--accent-color)]">今開いているタブを上書きする
              </label>
              <label class="flex items-center text-sm cursor-pointer">
                <input type="radio" bind:group={$workspacesStore[editingListIndex].open_in_new_tab} value={true} on:change={triggerSave} class="mr-2 accent-[var(--accent-color)]">新しいタブで開く
              </label>
            </div>
          {/if}

          <!-- リンク管理 -->
          <div class="p-3 bg-black/5 rounded border border-black/10">
            <div class="flex justify-between items-center mb-2">
              <span class="text-xs opacity-70">🔗 リンク</span>
              <button on:click={() => openLinkModal()} class="px-2 py-1 bg-black/20 hover:bg-black/30 rounded text-xs transition">＋ 追加</button>
            </div>
            <div class="space-y-2">
              {#each $workspacesStore[editingListIndex].links || [] as link}
                <div class="flex items-center justify-between text-sm bg-black/10 p-2 rounded">
                  <span class="truncate flex-1 pr-2">{link.title}</span>
                  <div class="flex gap-3 shrink-0">
                    <button class="text-xs text-[var(--accent-color)] hover:brightness-110" on:click={() => openLinkModal(link)}>編集</button>
                    <button class="text-xs text-red-400 hover:text-red-300" on:click={() => deleteLink(link.id)}>削除</button>
                  </div>
                </div>
              {:else}
                <div class="text-xs opacity-50 text-center py-2">リンクはありません</div>
              {/each}
            </div>
          </div>

        </div>
      {/if}
      <div class="flex justify-end"><button class="px-4 py-2 bg-black/10 hover:bg-black/20 rounded text-sm transition" on:click={() => isManageModalOpen = false}>閉じる</button></div>
    </div>
  </div>
{/if}


<!-- リンク編集モーダル -->
{#if linkContextMenu.show && linkContextMenu.link}
  {@const targetLink = linkContextMenu.link}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="fixed inset-0 z-40" on:click={closeLinkMenu} on:contextmenu|preventDefault={closeLinkMenu}></div>
  <div class="fixed border border-black/20 rounded shadow-xl z-50 py-1 w-32" style="left: {linkContextMenu.x}px; top: {linkContextMenu.y}px; background-color: var(--menu-bg); color: var(--text-color);">
    <button class="block w-full text-left px-4 py-2 text-sm hover:bg-black/10 transition" on:click={() => { openLinkModal(targetLink); closeLinkMenu(); }}>編集</button>
    <button class="block w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-black/10 transition" on:click={() => deleteLink(targetLink.id)}>削除</button>
  </div>
{/if}

{#if isLinkModalOpen}
  <div class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
    <div class="p-6 rounded shadow-lg border border-black/20 w-96" style="background-color: var(--menu-bg); color: var(--text-color);">
      <h2 class="text-lg font-bold mb-4">{editingLinkId ? 'リンクを編集' : 'リンクを追加'}</h2>
      <input type="text" class="w-full bg-black/10 border border-black/20 rounded p-2 text-sm mb-4 outline-none" bind:value={linkTitle} placeholder="表示テキスト" />
      <input type="text" class="w-full bg-black/10 border border-black/20 rounded p-2 text-sm mb-6 outline-none" bind:value={linkUrl} placeholder="URL" />
      <div class="flex justify-end gap-2">
        <button class="px-4 py-2 bg-black/10 hover:bg-black/20 rounded text-sm transition" on:click={() => isLinkModalOpen = false}>キャンセル</button>
        <button class="px-4 py-2 bg-[var(--accent-color)] text-white hover:brightness-110 rounded text-sm shadow transition" on:click={saveLink}>保存</button>
      </div>
    </div>
  </div>
{/if}
<!-- --- END OF src/components/Modals/WorkspaceManager.svelte --- -->