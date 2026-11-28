<!-- --- START OF src/components/SettingsModal.svelte --- -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import ThemeSettings from './ThemeSettings.svelte';
  import StyleSettings from './StyleSettings.svelte';
  import { activeStyleSlot, customStyleSlots, defaultStyle, applyStyleToRoot } from '../../features/styleSettings/styleStore';
  import { activeTheme, type Theme, applyThemeToRoot } from '../../lib/settings/theme';
  import { STORAGE_KEYS } from '../../lib/settings/storageKeys';
  import { editorFont, registeredTags, workspacesStore, currentWorkspaceIndex } from '../../lib/stores';
  import { open as openDialog } from '@tauri-apps/plugin-dialog';

  import { requestSaveWorkspaces } from '../../lib/workspace/workspaceManager';
  import { X } from 'lucide-svelte';

  const dispatch = createEventDispatcher();

  let tempFont = $editorFont || 'sans-serif';
  let activeSettingsTab = 'general';
  
  let tempTheme: Theme = { ...$activeTheme };

    // テーマが変更されたら即座に画面へ反映し、保存する（Obsidian風リアルタイムプレビュー）
  $: if (tempTheme) {
    applyThemeToRoot(tempTheme);
    $activeTheme = { ...tempTheme };
    localStorage.setItem(STORAGE_KEYS.ACTIVE_THEME, JSON.stringify(tempTheme));
  }

    // スタイルの編集用の一時データ
  let tempStyle = JSON.parse(JSON.stringify($activeStyleSlot));
  let tempCustomSlots = JSON.parse(JSON.stringify($customStyleSlots));

  let saveTimeout: ReturnType<typeof setTimeout>;

  let newTagInput = '';
  let selectedTagToRemove = '';

  // タグ管理の処理
  function addTag() {
    const t = newTagInput.trim();
    if (t && !$registeredTags.includes(t)) {
      $registeredTags = [...$registeredTags, t];
      localStorage.setItem(STORAGE_KEYS.REGISTERED_TAGS, JSON.stringify($registeredTags));
      newTagInput = '';
    }
  }
  function removeTag() {
    if (selectedTagToRemove) {
      $registeredTags = $registeredTags.filter(t => t !== selectedTagToRemove);
      localStorage.setItem(STORAGE_KEYS.REGISTERED_TAGS, JSON.stringify($registeredTags));
      selectedTagToRemove = '';
    }
  }

  // タスク除外ファイルの解除処理
  function removeExcludePath(pathToRemove: string) {
    workspacesStore.update(ws => {
      const current = ws[$currentWorkspaceIndex];
      if (current && current.task_exclude_paths) {
        current.task_exclude_paths = current.task_exclude_paths.filter((p: string) => p !== pathToRemove);
      }
      return ws;
    });
    requestSaveWorkspaces(); // ★即時反映される操作はその場でキューに入れて安全に保存
  }

  // タスク除外見出しの解除処理
  function removeExcludeHeading(headingToRemove: string) {
    workspacesStore.update(ws => {
      const current = ws[$currentWorkspaceIndex];
      if (current && current.task_exclude_headings) {
        current.task_exclude_headings = current.task_exclude_headings.filter((h: string) => h !== headingToRemove);
      }
      return ws;
    });
    requestSaveWorkspaces(); // ★即時反映される操作はその場でキューに入れて安全に保存
  }


  // 画像フォルダの選択ダイアログ
  async function selectImageFolder() {
    const selectedPath = await openDialog({ directory: true, multiple: false });
    if (typeof selectedPath === 'string') {
      workspacesStore.update(ws => {
        const current = ws[$currentWorkspaceIndex];
        if (current) {
          if (!current.image_folders) current.image_folders = [];
          if (!current.image_folders.includes(selectedPath)) {
            current.image_folders = [...current.image_folders, selectedPath];
          }
        }
        return ws;
      });
      requestSaveWorkspaces(); // ★即時反映される操作はその場でキューに入れて安全に保存
    }
  }

  // 画像フォルダの削除
  function removeImageFolder(folder: string) {
    workspacesStore.update(ws => {
      const current = ws[$currentWorkspaceIndex];
      if (current && current.image_folders) {
        current.image_folders = current.image_folders.filter((f: string) => f !== folder);
      }
      return ws;
    });
    requestSaveWorkspaces(); // ★即時反映される操作はその場でキューに入れて安全に保存
  }


  // 設定を確定して閉じる（Obsidian風オートセーブ）
  function handleClose() {

    // テーマの保存
    $activeTheme = { ...tempTheme };
    localStorage.setItem(STORAGE_KEYS.ACTIVE_THEME, JSON.stringify($activeTheme));

    // スタイルの保存と適用
    $activeStyleSlot = tempStyle;
    $customStyleSlots = tempCustomSlots;
    localStorage.setItem(STORAGE_KEYS.ACTIVE_STYLE, JSON.stringify(tempStyle));
    localStorage.setItem(STORAGE_KEYS.CUSTOM_STYLE_SLOTS, JSON.stringify(tempCustomSlots));
    applyStyleToRoot(tempStyle);

    workspacesStore.update(ws => {
      if (ws[$currentWorkspaceIndex]) {
        ws[$currentWorkspaceIndex].editor_font = tempStyle.editorFont;
      }
      return ws;
    });

    // ★ワークスペースマネージャーに安全な保存を要求する
    requestSaveWorkspaces();
    dispatch('close');
  }

  // Escキーで閉じる
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      handleClose();
    }
  }

</script>


<svelte:window on:keydown={handleKeydown} />

<!-- 背景クリックでも閉じられるオーバーレイ -->
<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div 
  class="fixed inset-0 z-50 flex items-center justify-center" 
  style="background-color: color-mix(in srgb, var(--text-color) 45%, transparent);" 
  on:click|self={handleClose}
>
  <div 
    class="rounded-lg shadow-2xl flex overflow-hidden w-[750px] h-[600px] relative border" 
    style="background-color: var(--bg-color); color: var(--text-color); border-color: color-mix(in srgb, var(--text-color) 15%, transparent);"
  >
     
    <!-- ★追加: Obsidian風の右上の閉じる（×）ボタン -->
    <button 
      class="absolute top-3 right-3 p-1.5 rounded-full transition opacity-60 hover:opacity-100 hover:bg-[color-mix(in_srgb,var(--text-color)_10%,transparent)] z-10"
      style="color: var(--text-color);"
      title="閉じる (Esc)"
      on:click={handleClose}
    >
      <X size={18} />
    </button>

    
    <!-- 左サイドバー（タブ） -->
    <div 
      class="w-1/4 p-4 space-y-1 text-sm border-r"
      style="background-color: color-mix(in srgb, var(--text-color) 3%, transparent); border-color: color-mix(in srgb, var(--text-color) 10%, transparent);"
    >
      <button class="w-full text-left px-3 py-2 rounded transition-colors {activeSettingsTab === 'general' ? 'bg-[var(--active-highlight-bg)] text-[var(--text-color)] font-bold' : 'opacity-70 hover:opacity-100 hover:bg-[color-mix(in_srgb,var(--text-color)_8%,transparent)]'}" on:click={() => activeSettingsTab = 'general'}>一般</button>
      <button class="w-full text-left px-3 py-2 rounded transition-colors {activeSettingsTab === 'theme' ? 'bg-[var(--active-highlight-bg)] text-[var(--text-color)] font-bold' : 'opacity-70 hover:opacity-100 hover:bg-[color-mix(in_srgb,var(--text-color)_8%,transparent)]'}" on:click={() => activeSettingsTab = 'theme'}>テーマ</button>
       <!-- スタイルタブのボタン -->
      <button class="w-full text-left px-3 py-2 rounded transition-colors {activeSettingsTab === 'style' ? 'bg-[var(--active-highlight-bg)] text-[var(--text-color)] font-bold' : 'opacity-70 hover:opacity-100 hover:bg-[color-mix(in_srgb,var(--text-color)_8%,transparent)]'}" on:click={() => activeSettingsTab = 'style'}>スタイル</button>
    </div>

    <!-- 右コンテンツ -->
    <div class="w-3/4 p-6 overflow-y-auto flex flex-col relative">
      
      {#if activeSettingsTab === 'general'}
        <h2 class="text-lg font-bold mb-6">一般設定</h2>
      
        <!-- 画像フォルダの設定エリア -->
        <div class="mb-6">
          <div class="text-sm opacity-80 mb-2">添付ファイル（画像）の保存フォルダ (複数指定可)</div>
          <ul class="mb-2 space-y-1">
            {#each $workspacesStore[$currentWorkspaceIndex]?.image_folders || [] as folder}
              <li 
                class="flex justify-between items-center rounded p-2 text-sm border"
                style="background-color: color-mix(in srgb, var(--text-color) 4%, transparent); border-color: color-mix(in srgb, var(--text-color) 10%, transparent);"
              >
                <span class="truncate" title={folder}>{folder}</span>
                <button 
                  class="px-2 py-0.5 rounded opacity-60 hover:opacity-100 hover:bg-[color-mix(in_srgb,var(--text-color)_12%,transparent)] transition font-bold" 
                  title="削除"
                  on:click={() => removeImageFolder(folder)}
                >×</button>
              </li>
            {/each}
          </ul>
          <div class="flex gap-2">
            <button 
              on:click={selectImageFolder} 
              class="w-full px-4 py-2 rounded text-sm border transition text-center hover:bg-[color-mix(in_srgb,var(--text-color)_12%,transparent)]"
              style="background-color: color-mix(in srgb, var(--text-color) 6%, transparent); border-color: color-mix(in srgb, var(--text-color) 12%, transparent); color: var(--text-color);"
            >＋ フォルダを追加</button>
          </div>
          <div class="text-xs opacity-50 mt-1">※上から順に画像を検索します。指定しない場合はファイルと同じ場所を探します。</div>
        </div>
        
        <!-- プロパティ表示設定エリア -->
        <div class="mb-6">
          <div class="text-sm opacity-80 mb-2">エディタ表示設定 (現在のワークスペース)</div>
          <label 
            class="flex items-center space-x-3 cursor-pointer rounded p-3 border transition hover:bg-[color-mix(in_srgb,var(--text-color)_6%,transparent)]"
            style="background-color: color-mix(in srgb, var(--text-color) 3%, transparent); border-color: color-mix(in srgb, var(--text-color) 10%, transparent);"
          >
            <input 
              type="checkbox" 
              class="rounded cursor-pointer"
              style="accent-color: var(--accent-color);"
              checked={$workspacesStore[$currentWorkspaceIndex]?.show_properties ?? false} 
              on:change={(e) => {
                const checked = e.currentTarget.checked;
                workspacesStore.update(ws => {
                  if (ws[$currentWorkspaceIndex]) ws[$currentWorkspaceIndex].show_properties = checked;
                  return ws;
                });
              }} 
            />
            <span class="text-sm">プレビューでファイルのプロパティ（フロントマター）を表示する</span>
          </label>
        </div>

        <hr class="mb-6 border-0 border-t" style="border-color: color-mix(in srgb, var(--text-color) 10%, transparent);">

        <!-- 💥 タスク除外設定エリア -->
        <div class="mb-6">
          <div class="text-sm opacity-80 mb-2">タスク一覧から除外されているファイル (現在のワークスペース)</div>
          {#if $workspacesStore[$currentWorkspaceIndex]?.task_exclude_paths && $workspacesStore[$currentWorkspaceIndex].task_exclude_paths.length > 0}
            <ul 
              class="rounded max-h-40 overflow-y-auto p-2 space-y-1 border"
              style="background-color: color-mix(in srgb, var(--text-color) 3%, transparent); border-color: color-mix(in srgb, var(--text-color) 10%, transparent);"
              >
               {#each $workspacesStore[$currentWorkspaceIndex].task_exclude_paths as path}
                <li class="flex justify-between items-center text-sm p-1.5 rounded hover:bg-[color-mix(in_srgb,var(--text-color)_6%,transparent)]">
                  <span class="truncate opacity-80" title={path}>{path.split(/[/\\]/).pop()}</span>
                  <button 
                    class="px-2 py-0.5 rounded opacity-60 hover:opacity-100 hover:bg-[color-mix(in_srgb,var(--text-color)_12%,transparent)] transition font-bold" 
                    title="解除"
                    on:click={() => removeExcludePath(path)}
                  >×</button>
                </li>
              {/each}
            </ul>
          {:else}
            <div 
              class="text-sm opacity-60 p-3 rounded border text-center"
              style="background-color: color-mix(in srgb, var(--text-color) 2%, transparent); border-color: color-mix(in srgb, var(--text-color) 8%, transparent);"
            >除外されているファイルはありません</div>
          {/if}
        </div>

        <!-- 💥 タスク除外見出し設定エリア -->
        <div class="mb-6">
          <div class="text-sm opacity-80 mb-2">タスク一覧から除外されている見出し (現在のワークスペース)</div>
          {#if $workspacesStore[$currentWorkspaceIndex]?.task_exclude_headings && $workspacesStore[$currentWorkspaceIndex].task_exclude_headings.length > 0}
            <ul 
              class="rounded max-h-40 overflow-y-auto p-2 space-y-1 border"
              style="background-color: color-mix(in srgb, var(--text-color) 3%, transparent); border-color: color-mix(in srgb, var(--text-color) 10%, transparent);"
            >
              {#each $workspacesStore[$currentWorkspaceIndex].task_exclude_headings as heading}
                <li class="flex justify-between items-center text-sm p-1.5 rounded hover:bg-[color-mix(in_srgb,var(--text-color)_6%,transparent)]">
                  <span class="truncate opacity-80" title={heading}>{heading}</span>
                  <button 
                    class="px-2 py-0.5 rounded opacity-60 hover:opacity-100 hover:bg-[color-mix(in_srgb,var(--text-color)_12%,transparent)] transition font-bold" 
                    title="解除"
                    on:click={() => removeExcludeHeading(heading)}>×</button>
                </li>
              {/each}
            </ul>
          {:else}
            <div 
              class="text-sm opacity-60 p-3 rounded border text-center"
              style="background-color: color-mix(in srgb, var(--text-color) 2%, transparent); border-color: color-mix(in srgb, var(--text-color) 8%, transparent);"
            >除外されている見出しはありません</div>
          {/if}
        </div>

        <hr class="mb-6 border-0 border-t" style="border-color: color-mix(in srgb, var(--text-color) 10%, transparent);">
        <div class="mb-6">
          <div class="text-sm opacity-80 mb-2">タグの管理</div>
          <div class="flex gap-2 mb-4">
            <input 
              type="text" 
              class="flex-1 rounded p-2 text-sm outline-none border transition focus:border-[var(--accent-color)]" 
              style="background-color: var(--bg-color); color: var(--text-color); border-color: color-mix(in srgb, var(--text-color) 15%, transparent);"
              bind:value={newTagInput} 
              placeholder="新しいタグ名を入力" 
              on:keydown={(e) => e.key === 'Enter' && addTag()} 
            />
            <button 
              class="px-4 py-2 rounded text-sm transition hover:bg-[color-mix(in_srgb,var(--text-color)_14%,transparent)] border"
              style="background-color: color-mix(in srgb, var(--text-color) 8%, transparent); border-color: color-mix(in srgb, var(--text-color) 12%, transparent); color: var(--text-color);"
              on:click={addTag}
            >登録</button>
          </div>
          <div class="flex gap-2">
            <select 
              class="flex-1 rounded p-2 text-sm outline-none border" 
              style="background-color: var(--bg-color); color: var(--text-color); border-color: color-mix(in srgb, var(--text-color) 15%, transparent);" 
              bind:value={selectedTagToRemove}
            >
              <option value="" disabled selected>登録済みのタグ一覧</option>
              {#each $registeredTags as tag}<option value={tag}>{tag}</option>{/each}
            </select>
            <button 
              class="px-4 py-2 rounded text-sm transition hover:bg-[color-mix(in_srgb,var(--text-color)_14%,transparent)] border"
              style="background-color: color-mix(in srgb, var(--text-color) 8%, transparent); border-color: color-mix(in srgb, var(--text-color) 12%, transparent); color: var(--text-color);"
              on:click={removeTag}
            >削除</button>
          </div>
        </div>

      {:else if activeSettingsTab === 'theme'}
        <ThemeSettings bind:tempTheme={tempTheme} />

      <!-- スタイルタブのコンテンツ -->
      {:else if activeSettingsTab === 'style'}
        <StyleSettings bind:tempStyle={tempStyle} bind:tempCustomSlots={tempCustomSlots} {defaultStyle} />
      {/if}

    </div>
  </div>
</div>
<!-- --- END OF src/components/SettingsModal.svelte --- -->