<!-- --- START OF src/components/Editor/TabBar.svelte --- -->
<script lang="ts">
  import { openTabs, activeTabId, openFileInNewTab, createNewTab, registeredTags, expandTreeRequest } from '../../lib/stores';
  import { invoke } from '@tauri-apps/api/core';
  import { Search, Plus, X, Tag, ChevronLeft, ChevronRight, Pin, PinOff } from 'lucide-svelte';
  import ContextMenu from '../../features/ContextMenu.svelte';
  import { buildCommonFileMenu, type MenuItem } from '../../lib/workspace/menuUtils';
  import { extractTags, updateTagsInContent } from '../../lib/utils/tagUtils';
  import { getContext } from 'svelte';
  import { isSpecialPath } from '../../lib/utils/pathUtils';

  // 親(Editor.svelte)から関数をもらって実行する（親に依存しないための工夫）
  export let handleTabClick: (id: string) => void;
  export let handleTabClose: (id: string) => void;

  // 💥 親からピン留め用の関数を受け取る（TreeNodeと同じ仕組み）
  const { pinNode, unpinNode, checkIsPinned } = (getContext('workspaceActions') || {}) as any;

  let tabMenu = { show: false, x: 0, y: 0, items: [] as MenuItem[], openSubLeft: false };

  // 表示用のタブ名（ファイルの場合は拡張子を隠す）
  function getTabDisplayName(title: string, path: string): string {
      if (isSpecialPath(path)) return title; // 特殊なタブはそのまま
      
      const dotIndex = title.lastIndexOf('.');
      if (dotIndex > 0) return title.substring(0, dotIndex);
      return title;
  }

    // タブをダブルクリックした時の処理
  function handleTabDoubleClick(path: string) {
      // 検索タブなどの特殊なタブ以外なら、ツリー展開を要求する
      if (path && !isSpecialPath(path)) {
          expandTreeRequest.set({ path, timestamp: Date.now() });
      }
  }

  function handleTabContextMenu(e: MouseEvent, tab: any) {
      e.preventDefault();
      let adjustedX = e.clientX;
      if (adjustedX + 200 > window.innerWidth) adjustedX = window.innerWidth - 200;
      const openSubLeft = (adjustedX + 200 + 150) > window.innerWidth;
            
      let items: MenuItem[] = [];
      
      // 特殊なタブ（検索など）と通常のファイルでメニュー内容を変える
      if (tab.path && !isSpecialPath(tab.path)) {
          const currentFileTags = extractTags(tab.content);
          items = buildCommonFileMenu({
              registeredTags: $registeredTags,
              currentFileTags,
              onOpenInNewTab: () => openFileInNewTab(tab.path, tab.title, tab.content),
              onAddTag: (tag) => operateTagForTab(tab, tag, true),
              onRemoveTag: (tag) => operateTagForTab(tab, tag, false)
          });
          // 💥 ピン留め処理を追加（ツリーと互換性を持たせるため、タブ情報から疑似ノードを作る）
          if (checkIsPinned && pinNode && unpinNode) {
              const pseudoNode = { type: 'File', name: tab.title, path: tab.path };
              const isPinned = checkIsPinned(pseudoNode);
              
              items.push({ divider: true });
              items.push({
                  label: isPinned ? 'ピン留め解除' : 'ピン留め',
                  icon: isPinned ? PinOff : Pin,
                  accent: true,
                  action: () => isPinned ? unpinNode(pseudoNode) : pinNode(pseudoNode)
              });
          }

      } else {
          // 特殊なタブの場合
          items = [{ label: '操作できません', disabled: true }];
      }
      
      tabMenu = { show: true, x: adjustedX, y: e.clientY, items, openSubLeft };
  }

  function closeTabMenu() { tabMenu.show = false; }

    // タブをクリックした時に最新のファイル内容を読み込む処理
  async function onTabClick(tab: any) {
      // 未保存状態ではなく、かつ検索タブなどの特殊なタブではない場合のみ最新化
      if (!tab.isDirty && tab.path && !isSpecialPath(tab.path)) {
          try {
              const content: string = await invoke('read_file_content', { path: tab.path });

              // 💥 最新の更新日時も取得する
              const modified = (await invoke('get_file_modified', { path: tab.path })) as number;

              openTabs.update(tabs => {
                  const target = tabs.find(t => t.id === tab.id);
                  if (target) {
                      target.content = content;
                      target.lastModified = modified; // 💥 更新日時も最新化
                  }
                  return tabs;
              });
          } catch (err) {
              console.error("最新ファイルの読み込みに失敗しました", err);
              alert(`「${tab.title}」の最新データの取得に失敗しました。ファイルが移動または削除された可能性があります。`);
          }
      }
      
      // 親から渡された本来のタブ切り替え処理を実行
      handleTabClick(tab.id);
  }

   // 💥 操作対象のタブオブジェクトを直接引数で受け取るように変更
   async function operateTagForTab(targetTab: any, tag: string, isAdd: boolean) {
      const tab = $openTabs.find(t => t.id === targetTab.id);

      if (!tab) { closeTabMenu(); return; }
      
      let content = tab.content;
      
      // tagUtils.ts の関数を使って置換
      const newContent = updateTagsInContent(content, tag, isAdd);

      if (content === newContent) {
          closeTabMenu(); 
          return; 
      }
      content = newContent;

      try {
          // 競合防止用の引数（lastModified, force）を追加
          const newModified = await invoke('save_file_content', { 
              path: tab.path,  
              content, 
              lastModified: tab.lastModified || 0, 
              force: true 
          });
          
          openTabs.update(tabs => { 
              const t = tabs.find(t => t.id === tab.id); 
              if (t) { 
                  t.content = content; 
                  t.isDirty = false;
                  t.lastModified = newModified as number; // 💥 追加: 日時も更新
              } 
              return tabs; 
          });
      } catch(err) { 
          alert("タグの保存に失敗しました"); 
      }
      closeTabMenu();
  }
</script>

<svelte:window on:click={closeTabMenu} />

<!-- タブバー本体 -->
<!-- 🔽 ボタンと被らないように右側に余白(pr-12)を追加 -->
<div class="flex border-b border-black/10 flex-wrap select-none pr-12" style="background-color: var(--menu-bg);">
  {#each $openTabs as tab}
      <!-- 🔽 max-w-[120px] を w-[140px] (固定幅) に変更してサイズを統一 -->
      <div 
          class="flex items-center px-2 py-1 text-xs w-[140px] cursor-pointer border-r border-black/10 border-b transition-colors
                 { $activeTabId === tab.id ? 'border-t-2' : 'border-t-2 border-t-transparent hover:opacity-70' }"
          style="{ $activeTabId === tab.id ? 'background-color: var(--bg-color); color: var(--text-color); border-top-color: var(--accent-color); border-bottom-color: transparent;' : 'background-color: transparent; color: inherit;' }"
          on:click={() => onTabClick(tab)}
          on:contextmenu={(e) => handleTabContextMenu(e, tab)}
          on:dblclick={() => handleTabDoubleClick(tab.path)} 
      >
          {#if tab.path === '__SEARCH__'}
              <Search size={14} class="mr-1.5 opacity-70 shrink-0" />
          {/if}
          <!--  表示する文字だけ拡張子を隠す（マウスオーバー時のツールチップは元の名前のまま） -->
          <span class="truncate flex-1" title={tab.title}>{getTabDisplayName(tab.title, tab.path)}</span>
          
          {#if tab.isDirty}
              <span class="ml-1 text-[10px] shrink-0" style="color: var(--accent-color);">●</span>
          {/if}
          <button class="ml-1 w-5 h-5 flex items-center justify-center shrink-0 rounded-full hover:bg-black/10 hover:text-red-400 transition" on:click|stopPropagation={() => handleTabClose(tab.id)}>
              <X size={12} />
          </button>
      </div>
  {/each}
  <button class="px-3 py-1 flex items-center justify-center opacity-60 hover:opacity-100 hover:bg-black/10 transition" title="新しいタブを開く" on:click={createNewTab}>
      <Plus size={16} />
  </button>
</div>

<!-- タブの右クリックメニュー -->
{#if tabMenu.show}

  <ContextMenu 
      x={tabMenu.x} 
      y={tabMenu.y} 
      items={tabMenu.items} 
      openSubLeft={tabMenu.openSubLeft}
      onClose={closeTabMenu} 
  />

{/if}
<!-- --- END OF src/components/Editor/TabBar.svelte --- -->