<script lang="ts">
  import { activeTheme, customThemes, defaultThemes, type Theme } from '../../lib/settings/theme';
  import { STORAGE_KEYS } from '../../lib/settings/storageKeys';
  import { get } from 'svelte/store';

  export let tempTheme: Theme;

  let selectedPreset = 'dark';
  let selectedCustomSlot = 'custom1';

  export function applyPreset() {
    const t = defaultThemes.find(x => x.id === selectedPreset) || $customThemes.find(x => x.id === selectedPreset);
    if (t) tempTheme = { ...t };
  }

  export function saveCustomTheme() {
    const index = $customThemes.findIndex(x => x.id === selectedCustomSlot);
    if (index !== -1) {
      const updated = get(customThemes);
      updated[index] = { ...tempTheme, id: selectedCustomSlot, name: updated[index].name };
      customThemes.set(updated);
      localStorage.setItem(STORAGE_KEYS.CUSTOM_THEMES, JSON.stringify(updated));
      alert('カスタムテーマを保存しました');
    }
  }
</script>

<h2 class="text-lg font-bold mb-6">テーマ設定</h2>

<div class="mb-6 bg-black/5 p-4 rounded border border-black/10">
  <div class="flex justify-between items-center">
    <span class="text-sm font-bold">テーマの適用</span>
    <div class="flex gap-2">
      <select class="border border-black/20 rounded p-1 text-sm outline-none" style="background-color: var(--bg-color); color: var(--text-color);" bind:value={selectedPreset}>
        <optgroup label="プリセット">{#each defaultThemes as theme}<option value={theme.id}>{theme.name}</option>{/each}</optgroup>
        <optgroup label="カスタム">{#each $customThemes as theme}<option value={theme.id}>{theme.name}</option>{/each}</optgroup>
      </select>
      <button class="px-4 py-1.5 bg-[var(--accent-color)] text-white rounded text-sm font-bold shadow hover:brightness-110 transition" on:click={applyPreset}>適用</button>
    </div>
  </div>
</div>

<div class="space-y-4 mb-6 px-2">
  <div class="flex justify-between items-center border-b border-black/5 pb-2">
    <span class="text-sm">エディタ・メニュー背景色</span>
    <input type="color" bind:value={tempTheme.bgColor} class="w-14 h-8 bg-transparent cursor-pointer rounded" />
  </div>
  <div class="flex justify-between items-center border-b border-black/5 pb-2">
    <span class="text-sm">メニュー・ポップアップ背景色</span>
    <input type="color" bind:value={tempTheme.menuBg} class="w-14 h-8 bg-transparent cursor-pointer rounded" />
  </div>
  <div class="flex justify-between items-center border-b border-black/5 pb-2">
    <span class="text-sm">文字色（全体・アイコン）</span>
    <input type="color" bind:value={tempTheme.textColor} class="w-14 h-8 bg-transparent cursor-pointer rounded" />
  </div>
    <!-- 💥 追加: 文字選択時の色 -->
  <div class="flex justify-between items-center border-b border-black/5 pb-2">
    <span class="text-sm">文字選択時の色</span>
    <input type="color" bind:value={tempTheme.selectionBg} class="w-14 h-8 bg-transparent cursor-pointer rounded" />
  </div>
  <div class="flex justify-between items-center border-b border-black/5 pb-2">
    <span class="text-sm">ツリー選択時の背景色</span>
    <input type="color" bind:value={tempTheme.activeHighlightBg} class="w-14 h-8 bg-transparent cursor-pointer rounded" />
  </div>
  <div class="flex justify-between items-center border-b border-black/5 pb-2">
    <span class="text-sm">スクロールバーの背景色</span>
    <input type="color" bind:value={tempTheme.scrollBg} class="w-14 h-8 bg-transparent cursor-pointer rounded" />
  </div>
  <div class="flex justify-between items-center border-b border-black/5 pb-2">
    <span class="text-sm">スクロールバーの色</span>
    <input type="color" bind:value={tempTheme.scrollThumb} class="w-14 h-8 bg-transparent cursor-pointer rounded" />
  </div>
  <div class="flex justify-between items-center pb-2">
    <span class="text-sm">ハイライト色（タブ上部等）</span>
    <input type="color" bind:value={tempTheme.accentColor} class="w-14 h-8 bg-transparent cursor-pointer rounded" />
  </div>
</div>

<div class="mt-auto bg-black/5 p-4 rounded border border-black/10">
  <div class="flex justify-between items-center">
    <span class="text-sm font-bold">現在の状態をカスタムテーマに保存</span>
    <div class="flex gap-2">
      <select class="border border-black/20 rounded p-1 text-sm outline-none" style="background-color: var(--bg-color); color: var(--text-color);" bind:value={selectedCustomSlot}>
        {#each $customThemes as theme}<option value={theme.id}>{theme.name}</option>{/each}
      </select>
      <button class="px-4 py-1.5 bg-black/30 hover:bg-black/50 rounded text-sm transition" on:click={saveCustomTheme}>保存</button>
    </div>
  </div>
</div>