<!-- 責務: サイドバー内の外部リンク一覧の表示・コンテキストメニューおよび開く処理の管理 -->
<script lang="ts">
  import { openUrl } from '@tauri-apps/plugin-opener';

  export let links: Array<{ id: string; title: string; url: string }> = [];
  export let onLinkDelete: (id: string) => void = () => {};

  let contextMenu = { show: false, x: 0, y: 0, linkId: '' };

  function handleContextMenu(e: MouseEvent, id: string) {
    e.preventDefault();
    contextMenu = { show: true, x: e.clientX, y: e.clientY, linkId: id };
  }

  function closeMenu() {
    contextMenu.show = false;
  }

  function handleDelete() {
    if (contextMenu.linkId) {
      onLinkDelete(contextMenu.linkId);
    }
    closeMenu();
  }

  // キーボードでの選択（Enter / Space）でリンクを開く
  function handleKeydown(e: KeyboardEvent, url: string) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault(); // Spaceキーでの画面スクロールを防止
      openUrl(url);
    }
  }
</script>

<svelte:window on:click={closeMenu} />

{#if links && links.length > 0}
  <div class="border-t flex flex-col shrink-0 relative" style="border-color: color-mix(in srgb, var(--text-color) 20%, transparent);">
    <div class="p-2 overflow-y-auto space-y-1 max-h-[150px]">
      {#each links as link (link.id)}

        <div 
          role="link"
          tabindex="0"
          class="text-sm hover:underline cursor-pointer truncate pl-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent-color)] focus-visible:-outline-offset-2" 
          style="color: color-mix(in srgb, var(--accent-color) 80%, var(--text-color));"
          on:click={() => openUrl(link.url)} 
          on:keydown={(e) => handleKeydown(e, link.url)}
          on:contextmenu={(e) => handleContextMenu(e, link.id)}
        >
          {link.title}
        </div>
      {/each}
    </div>

    {#if contextMenu.show}
      <div 
        class="fixed z-50 py-1 rounded shadow-md border text-xs"
        style="top: {contextMenu.y}px; left: {contextMenu.x}px; background-color: var(--menu-bg); color: var(--text-color); border-color: color-mix(in srgb, var(--text-color) 20%, transparent);"
      >
        <button 
          class="w-full text-left px-3 py-1 hover:bg-[var(--active-highlight-bg)]" style="color: var(--text-color);" 
          on:click={handleDelete}
        >
          リンクを削除
        </button>
      </div>
    {/if}
  </div>
{/if}