<!-- 責務: ワークスペース内の単一ファイル・フォルダ（ノード）を表示し、再帰的な展開とユーザー操作（開く・右クリックメニュー・インライン編集）を処理するUIコンポーネント -->
<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import { workspacesStore, openFileInCurrentTab, openFileInNewTab, activeTabId, openTabs, switchTab, registeredTags, expandTreeRequest } from '../lib/stores'; 
  import { getContext, tick } from 'svelte';
  import { Library, FolderOpen, Folder, FileText } from 'lucide-svelte';

  import { extractTags, updateTagsInContent } from '../lib/utils/tagUtils';
  import ContextMenu from '../features/ContextMenu.svelte';
  import { buildTreeNodeMenu, type MenuItem } from '../lib/workspace/menuUtils';

    import { 
    requestSaveWorkspaces, 
    removeNodeFromWorkspace, 
    pinNodeToWorkspace, 
    unpinNodeFromWorkspace, 
    isNodePinned, 
    getWorkspaceClickBehavior, 
    getWorkspaceGlobalSort, 
    setWorkspaceNodeSort,
    setWorkspaceNodeCategory
  } from '../lib/workspace/workspaceManager';

  import { saveAndUpdateTab } from '../lib/editor/fileManager';

    // UI操作（モーダル）に関するものだけを Context から受け取る
  const { editSmartFolder, openNewFileModal } = getContext('workspaceActions') as any;

  export let node: any;
  // isReadonly を削除し、親から引き継ぐ情報に変更
  export let ownerId: string;
  // 親フォルダからのソート設定を引き継ぐためのプロパティ
  export let parentSortBy: string | null = null;
  export let parentSortOrder: string | null = null;
  let isOpen = false;

  $: activeTab = $openTabs.find(t => t.id === $activeTabId);
  $: isActive = activeTab && activeTab.path === node.path;

    // 💥 右クリックメニューの状態
  let showMenu = false;
  let menuX = 0;
  let menuY = 0;
  let menuItems: MenuItem[] = [];

     // 💥対象ファイルの現在のタグを保持する変数
  let currentFileTags: string[] = [];

    // 目的のファイルが見つかった際に画面内へ自動スクロールさせるための要素参照と、処理済みの記録
  let nodeElement: HTMLDivElement;
  let lastProcessedTimestamp = 0; 
  let lastScrolledTimestamp = 0;

  // インライン入力用の状態管理
  let editMode: 'none' | 'name' | 'category' = 'none';
  let editInput = "";

  // スマートフォルダ用に、自分の中身(子や孫)に目的のファイルが含まれているか調べる関数
  function containsPath(folderNode: any, targetPath: string): boolean {
    if (!folderNode.children) return false;
    for (const child of folderNode.children) {
      if (child.type === 'File' && child.path === targetPath) return true;
      if (child.type === 'Folder' && containsPath(child, targetPath)) return true;
    }
    return false;
  }

  // 💥 変更: ツリー展開リクエストの監視（バグ修正とスマートフォルダ対応）
  $: if ($expandTreeRequest && node.type === 'Folder') {
      const req = $expandTreeRequest;
      
      // 同じリクエストで何度も処理が暴走する（閉じられなくなる）のを防ぐ
      if (lastProcessedTimestamp !== req.timestamp) {
          let shouldOpen = false;

          if (node.smart_rules || node.is_virtual_wrapper) {
              // スマートフォルダなどは、すでに中に入っているファイル一覧から探す
              shouldOpen = containsPath(node, req.path);
          } else if (node.original_path) {
              // 普通のフォルダは、今まで通りパスの前方一致で判定する
              shouldOpen = req.path.startsWith(node.original_path + '/') || req.path.startsWith(node.original_path + '\\');
          }

          if (shouldOpen) {
              isOpen = true;
              lastProcessedTimestamp = req.timestamp; // 💥 一度開いたら記録をつける

              // 普通のフォルダでまだ中身を読み込んでいない場合はバックエンドから読み込む
              if (node.children && node.children.length === 0 && node.original_path && !node.smart_rules) {
                  invoke('read_directory', { path: node.original_path }).then(res => {
                          workspacesStore.update(ws => {
                          node.children = res as any[];
                          return ws;
                      });
                  }).catch(e => console.error("フォルダ自動展開エラー:", e));
              }
          }
      }
  }

  // 💥 変更: 目的のファイルノードに到達したらスクロール（何度もスクロールしないように修正）
  $: if ($expandTreeRequest && node.type === 'File' && node.path === $expandTreeRequest.path) {
      if (nodeElement && lastScrolledTimestamp !== $expandTreeRequest.timestamp) {
          lastScrolledTimestamp = $expandTreeRequest.timestamp;
          setTimeout(() => {
              nodeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 150);
      }
  }

  // 現在のソート設定（個別設定があれば優先、なければ全体設定）を計算し、常にソートされた配列を作る
  // 中間の親フォルダから設定を引き継いでいれば、グローバル設定より優先する
  $: globalSort = getWorkspaceGlobalSort();
  $: sortBy = node.sort_by || parentSortBy || globalSort.by;
  $: sortOrder = node.sort_order || parentSortOrder || globalSort.order;

  // 表示用の名前（ファイルの場合は拡張子を隠す）
  $: displayName = (() => {
    if (!node.name) return '';
    if (node.type === 'File') {
      const dotIndex = node.name.lastIndexOf('.');
      if (dotIndex > 0) return node.name.substring(0, dotIndex); // 拡張子を除外
    }
    return node.name;
  })();

  // 💥 高速化したソート処理（localeCompare を廃止し、シンプルな比較に差し替え）
  $: sortedChildren = [...(node.children || [])].sort((a, b) => {
    const isDirA = a.type === 'Folder';
    const isDirB = b.type === 'Folder';
    if (isDirA !== isDirB) return isDirA ? -1 : 1;

    let comp = 0;
    if (sortBy === 'created') comp = (a.created || 0) - (b.created || 0);
    else if (sortBy === 'modified') comp = (a.modified || 0) - (b.modified || 0);
    else {
      const nameA = (a.name || '').toLowerCase();
      const nameB = (b.name || '').toLowerCase();
      comp = nameA < nameB ? -1 : (nameA > nameB ? 1 : 0);
    }
    
    return sortOrder === 'asc' ? comp : -comp;
  });

  async function handleClick() {
    if (node.type === 'Folder') {
          isOpen = !isOpen;
      // !node.smart_rules を追加し、スマートフォルダの場合はこの処理をスキップさせる
      if (isOpen && node.children && node.children.length === 0 && node.original_path && !node.smart_rules) {
        try {
          const children = await invoke('read_directory', {  
              path: node.original_path,
              sortBy,
              sortOrder
          });
            workspacesStore.update(ws => {
            node.children = children as any[];
            return ws;
          });
        } catch (e) {
          console.error("フォルダ読み込み失敗:", e);
        }
      }
    } else if (node.type === 'File') {
      try {
        const content = await loadFileContent(node.path);
        const openInNewTab = getWorkspaceClickBehavior(); // 💥 設定を取得

        if (openInNewTab) {
          // すでに開いている場合はそのタブをアクティブにする
          const existingTab = $openTabs.find(t => t.path === node.path);
          if (existingTab) {
            switchTab(existingTab.id);
          } else {
            openFileInNewTab(node.path, node.name, content);
          }
        } else {
          openFileInCurrentTab(node.path, node.name, content);
        }
      } catch (e) {
        console.error("ファイル読み込み失敗:", e);
      }
    }
  }

  // 右クリック時の処理（メニューを出す）
  async function handleContextMenu(e: MouseEvent) {
    e.preventDefault();
    if (node.type === 'File') {
      try {
        const content = await getTargetContent();
        currentFileTags = extractTags(content);
      } catch(err) {
        console.error("タグ取得失敗:", err);
      }
    }
    // 💥 追加: メニューが画面下部にはみ出さないようにY座標を調整
    // メニューの想定最大高さを約 400px として計算
    let adjustedY = e.clientY;
    const estimatedMenuHeight = 400;
    
    if (adjustedY + estimatedMenuHeight > window.innerHeight) {
        // 下にはみ出る場合は、画面下端に収まるように上にずらす
        adjustedY = Math.max(0, window.innerHeight - estimatedMenuHeight);
    }


    // 💥 メニュー構築を外部ファイルに委譲
    menuItems = buildTreeNodeMenu({
      node,
      isPinned: isNodePinned(node),
      sortBy,
      sortOrder,
      registeredTags: $registeredTags,
      currentFileTags,
      actions: {
        openInNewTab: async () => openFileInNewTab(node.path, node.name, await loadFileContent(node.path)),
        addTag: (tag) => operateTag(tag, true),
        removeTag: (tag) => operateTag(tag, false),
        togglePin: () => isNodePinned(node) ? unpinNodeFromWorkspace(node.path) : pinNodeToWorkspace(node),
        editSmartFolder: () => editSmartFolder(node),
        renameFolder: () => renameFolder(),
        createNewFile: () => createNewFileInFolder(),
        setSort: (by, order) => setWorkspaceNodeSort(node, by, order),
        openExplorer: () => openInExplorer(),
        requestCategoryEdit: () => { editMode = 'category'; editInput = node.category || ''; },
        removeNode: () => removeNodeFromWorkspace(node, ownerId)

      }

    });

    showMenu = true;
    menuX = e.clientX;
    menuY = adjustedY;
  }

  // 💥 追加: ファイルの中身を取得（タブで開いていればタブの未保存データ、なければ実際のファイルから）
  async function getTargetContent() {
    const tab = $openTabs.find(t => t.path === node.path);
    if (tab) return tab.content;
    return await loadFileContent(node.path);
  }



 // 💥 変更: operateTag の中身を大幅にスリム化
  async function operateTag(tag: string, isAdd: boolean) {
    let content = await getTargetContent();
    
    // 💥 追加: ロジック専用ファイルに文字列処理を任せる
    const newContent = updateTagsInContent(content, tag, isAdd);
    
    // 変更がなければ何もせずに閉じる
    if (content === newContent) {
      closeMenu();
      return;
    }
    content = newContent;


    // 保存処理
    try {
// 直接の invoke や Store の手動更新をやめ、安全なマネージャーに委譲
      await saveAndUpdateTab(node.path, content, 0, true);
    } catch(err) {
      alert("タグの保存に失敗しました");
    }
    closeMenu();
  }

  function closeMenu() {
    showMenu = false;
  }

async function loadFileContent(path: string): Promise<string> {
    return await invoke<string>('read_file_content', { path });
}

  async function renameFolder() {
    editMode = 'name';
    editInput = node.name;
  }

  function createNewFileInFolder() {
    openNewFileModal(node.original_path, async () => {
      isOpen = true;
      const children = await invoke('read_directory', { path: node.original_path });
      workspacesStore.update(ws => {
        node.children = children as any[];
        return ws;
      });
      await tick();
      requestSaveWorkspaces();
    });
  }


  // 入力確定処理
  async function saveEdit() {
    if (editMode === 'none') return;
    
    const val = editInput.trim();
    
    if (editMode === 'name' && val !== '') {
      workspacesStore.update(wsList => {
        node.name = val;
        return wsList;
      });
      await tick();
      requestSaveWorkspaces();
    } else if (editMode === 'category') {
      // カテゴリ処理はマネージャーに委譲
      setWorkspaceNodeCategory(node, val);
    }
    
    editMode = 'none';

  }

  // エンター・エスケープキーの制御
  function handleEditKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') saveEdit();
    else if (e.key === 'Escape') editMode = 'none';
  }

  // キーボードでの選択（Enter / Space）の制御
  function handleNodeKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault(); // Spaceキーでの画面スクロールを防止
      handleClick();
    }
  }

  async function openInExplorer() {
    try {
      // 💥 Rust側に作ってもらったコマンドを呼ぶ
      await invoke('open_folder', { path: node.original_path });
    } catch (e) {
      console.error("エクスプローラー起動失敗:", e);
    }
  }
</script>

<svelte:window on:click={closeMenu} />

<div class="ml-2 relative">
  <!-- 💥 isActive のときに背景色を青っぽくする -->
  <div 
    bind:this={nodeElement}
    role="treeitem"
    tabindex="0"
    class="flex items-center p-1 rounded text-sm cursor-pointer select-none transition-colors 
    focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent-color)] focus-visible:-outline-offset-2
           {isActive ? 'font-bold' : 'hover:opacity-70'}"
    style="{isActive ? 'background-color: color-mix(in srgb, var(--active-highlight-bg) 80%, transparent); color: var(--text-color);' : 'background-color: transparent; color: inherit;'}"
    on:click={handleClick}
    on:keydown={handleNodeKeydown}
    on:contextmenu={handleContextMenu}
  >
    {#if node.type === 'Folder'}
      <span class="mr-1.5 flex items-center justify-center w-4 shrink-0 opacity-70">
        {#if node.is_virtual_wrapper}
          <Library size={14} />
        {:else}
          {#if isOpen}<FolderOpen size={14} />{:else}<Folder size={14} />{/if}
        {/if}       
      </span>
    {/if}


    <!-- 💥 名前変更時のみ、インライン入力欄を表示 -->
    {#if editMode === 'name'}
      <!-- svelte-ignore a11y-autofocus -->
      <input 
        type="text" 
        bind:value={editInput} 
        on:keydown={handleEditKeydown}
        on:blur={saveEdit}
        class="text-sm bg-black/20 text-white border border-[var(--accent-color)] rounded px-1 py-0.5 w-full outline-none"
        autofocus
        on:click|stopPropagation
      />
    {:else}
      <span class="truncate">{displayName}</span>
    {/if}
  </div>

 <!-- 💥 カスタムコンテキストメニュー -->
  {#if showMenu}

    <ContextMenu 
      x={menuX} 
      y={menuY} 
      items={menuItems} 
      onClose={closeMenu} 
    />

  {/if}

    <!-- 💥 カテゴリ設定用の独立したポップアップ -->
  {#if editMode === 'category'}
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div class="fixed inset-0 z-[60]" on:click|stopPropagation={saveEdit} on:contextmenu|preventDefault|stopPropagation></div>
    <div 
      class="fixed z-[70] p-2 rounded shadow-xl border border-black/20 flex flex-col gap-1"
      style="left: {menuX}px; top: {menuY}px; background-color: var(--menu-bg); color: var(--text-color);"
    >
      <label class="text-xs font-bold opacity-70">カテゴリを設定（空欄でカテゴリ解除）</label>
      <!-- svelte-ignore a11y-autofocus -->
      <input 
        type="text" 
        bind:value={editInput} 
        on:keydown={handleEditKeydown}
        class="text-sm bg-black/20 text-[var(--text-color)] border border-[var(--accent-color)] rounded px-2 py-1 w-48 outline-none"
        placeholder="カテゴリなし（空欄）"
        autofocus
      />
    </div>
  {/if}


  {#if isOpen && sortedChildren && sortedChildren.length > 0}
    <div 
      class="ml-[9px] pl-[7px] border-l transition-colors hover:border-[color-mix(in_srgb,var(--text-color)_30%,transparent)]"
      style="border-color: color-mix(in srgb, var(--text-color) 10%, transparent);"
    >
      {#each sortedChildren as childNode}
        <!-- 解決したソート設定を子孫へ引き継がせる -->
        <svelte:self node={childNode} {ownerId} parentSortBy={sortBy} parentSortOrder={sortOrder} />
      {/each}
    </div>
  {/if}

</div>