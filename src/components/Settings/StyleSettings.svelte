<!-- --- START OF src/components/StyleSettings.svelte --- -->
<script lang="ts">
    import type { StyleSlot } from '../../features/styleSettings/styleStore';

    export let tempStyle: StyleSlot;
    export let tempCustomSlots: StyleSlot[];
    export let defaultStyle: StyleSlot;

    let editingSlotId = tempStyle.id;

    // スロットの選択が切り替わったときの処理
    function handleSlotChange() {
        if (editingSlotId === 'default') {
            // デフォルトは固定値のためディープコピー
            tempStyle = JSON.parse(JSON.stringify(defaultStyle));
        } else {
            const target = tempCustomSlots.find(s => s.id === editingSlotId);
            if (target) {
                tempStyle = JSON.parse(JSON.stringify(target));
            }
        }
    }

    // プルダウンのIDと、読み込まれたデータのIDが完全に一致している時だけ自動保存する
    // （切り替えの瞬間に誤って上書きしてしまうのを防ぐ）
    $: if (tempStyle.id !== 'default' && tempStyle.id === editingSlotId) {
        const index = tempCustomSlots.findIndex(s => s.id === tempStyle.id);
        if (index !== -1) {
            tempCustomSlots[index] = { ...tempStyle };
        }
    }

    // UI用のH1〜H6の定義配列
    const headings = [
        { label: 'H1', ref: tempStyle.h1 },
        { label: 'H2', ref: tempStyle.h2 },
        { label: 'H3', ref: tempStyle.h3 },
        { label: 'H4', ref: tempStyle.h4 },
        { label: 'H5', ref: tempStyle.h5 },
        { label: 'H6', ref: tempStyle.h6 },
    ];
</script>

<div class="h-full flex flex-col">
    <h2 class="text-lg font-bold mb-4">スタイル設定</h2>


    <!-- スロット選択 (Obsidian風のヘッダー設定項目) -->
    <div class="flex items-center justify-between py-3 border-b mb-4" style="border-color: color-mix(in srgb, var(--text-color) 10%, transparent);">
        <div>
            <div class="text-sm font-medium">適用するスロット</div>
            <div class="text-xs opacity-60">スタイルのプリセットまたはカスタムスロットを選択します</div>
        </div>
        <select 
            class="rounded p-1.5 text-sm outline-none border transition w-48 focus:border-[var(--accent-color)]" 
            style="background-color: var(--bg-color); color: var(--text-color); border-color: color-mix(in srgb, var(--text-color) 15%, transparent);" 
            bind:value={editingSlotId} 
            on:change={handleSlotChange}
        >
            <option value="default" style="background-color: var(--bg-color); color: var(--text-color);">デフォルトスタイル</option>
            {#each tempCustomSlots as slot}
                 <option value={slot.id} style="background-color: var(--bg-color); color: var(--text-color);">{slot.name}</option>
            {/each}
        </select>
    </div>
                        {#if editingSlotId === 'default'}
                <div class="text-xs opacity-60 mt-3" style="color: color-mix(in srgb, var(--accent-color) 80%, var(--text-color));">
                    ※ デフォルトスタイルは固定です。スロット１〜３を選択してカスタマイズしてください。
                </div>
            {/if}
    <!-- 編集エリア（デフォルト選択時はリードオンリー風にするため半透明化） -->
    <div class="flex-1 overflow-y-auto pr-2 space-y-6 pb-8" class:opacity-50={editingSlotId === 'default'} class:pointer-events-none={editingSlotId === 'default'}>
        

        <!-- エディタ全体の設定 (Obsidian風リスト形式) -->
        <div 
            class="p-4 rounded border"
            style="background-color: color-mix(in srgb, var(--text-color) 3%, transparent); border-color: color-mix(in srgb, var(--text-color) 10%, transparent);"
        >
            <div class="text-sm font-bold mb-1">エディタ全体の設定</div>
            <div class="text-xs opacity-60 mb-2">フォントや行間など、エディタの基本スタイルを設定します</div>

            <!-- フォント名 -->
            <div class="flex items-center justify-between py-2.5 border-b" style="border-color: color-mix(in srgb, var(--text-color) 8%, transparent);">
                <div>
                    <div class="text-sm font-medium">フォント名</div>
                    <div class="text-xs opacity-60">カンマ区切りで複数指定可能</div>
                </div>
                <input 
                    type="text" 
                    class="w-56 rounded p-1.5 text-sm outline-none border transition focus:border-[var(--accent-color)]" 
                    style="background-color: var(--bg-color); color: var(--text-color); border-color: color-mix(in srgb, var(--text-color) 15%, transparent);"
                    bind:value={tempStyle.editorFont} 
                    placeholder="sans-serif, Meiryo..." 
                />
            </div>

            <!-- フォントサイズ -->
            <div class="flex items-center justify-between py-2.5 border-b" style="border-color: color-mix(in srgb, var(--text-color) 8%, transparent);">
                <div>
                    <div class="text-sm font-medium">フォントサイズ</div>
                    <div class="text-xs opacity-60">本文テキストの大きさ (px)</div>
                </div>
                <div class="flex items-center gap-1.5">
                    <input 
                        type="number" 
                        min="8" 
                        max="48" 
                        class="w-20 rounded p-1.5 text-sm outline-none border text-right transition focus:border-[var(--accent-color)]" 
                        style="background-color: var(--bg-color); color: var(--text-color); border-color: color-mix(in srgb, var(--text-color) 15%, transparent);"
                        bind:value={tempStyle.editorFontSize} 
                    />
                    <span class="text-xs opacity-60">px</span>
                </div>
            </div>

            <!-- 行間 -->
            <div class="flex items-center justify-between py-2.5">
                <div>
                    <div class="text-sm font-medium">行間</div>
                    <div class="text-xs opacity-60">行の高さの倍率</div>
                </div>
                <div class="flex items-center gap-1.5">
                    <input 
                        type="number" 
                        step="0.1" 
                        min="1.0" 
                        max="3.0" 
                        class="w-20 rounded p-1.5 text-sm outline-none border text-right transition focus:border-[var(--accent-color)]" 
                        style="background-color: var(--bg-color); color: var(--text-color); border-color: color-mix(in srgb, var(--text-color) 15%, transparent);"
                        bind:value={tempStyle.lineHeight} 
                    />
                    <span class="text-xs opacity-60">倍</span>
                </div>
            </div>
        </div>

        <!-- 見出しの設定 (Obsidian風テーブル形式) -->
        <div 
            class="p-4 rounded border"
            style="background-color: color-mix(in srgb, var(--text-color) 3%, transparent); border-color: color-mix(in srgb, var(--text-color) 10%, transparent);"
        >
            <div class="flex items-center justify-between mb-1">
                <div class="text-sm font-bold">見出しのスタイル設定</div>
                {#if editingSlotId === 'default'}
                    <span class="text-xs px-2 py-0.5 rounded opacity-70" style="background-color: color-mix(in srgb, var(--text-color) 10%, transparent);">読み取り専用</span>
                {/if}
            </div>
            <div class="text-xs opacity-60 mb-3">各見出しレベル（H1〜H6）のサイズと装飾を設定します</div>
            
            <div class="flex flex-col">

                <!-- Svelteのリアクティビティを確実にするため、各要素を直接バインドします -->
                {#each [
                    { label: 'H1', item: tempStyle.h1 },
                    { label: 'H2', item: tempStyle.h2 },
                    { label: 'H3', item: tempStyle.h3 },
                    { label: 'H4', item: tempStyle.h4 },
                    { label: 'H5', item: tempStyle.h5 },
                    { label: 'H6', item: tempStyle.h6 }
                ] as h}
                     
                    <div 
                        class="flex items-center justify-between py-2 border-b last:border-b-0 px-2 rounded transition-colors hover:bg-[color-mix(in_srgb,var(--text-color)_6%,transparent)]"
                        style="border-color: color-mix(in srgb, var(--text-color) 8%, transparent);"
                    >
                        <!-- 見出しラベル（Obsidian風アクセントピル） -->
                        <span 
                            class="text-xs font-bold px-2 py-0.5 rounded text-center w-8"
                            style="background-color: color-mix(in srgb, var(--accent-color) 15%, transparent); color: color-mix(in srgb, var(--accent-color) 80%, var(--text-color));"
                        >
                            {h.label}
                        </span>
                        

                        <!-- コントロール（サイズ + 下線/太字/斜体） -->
                        <div class="flex items-center gap-5">
                            <div class="flex items-center gap-1">
                                <input 
                                    type="number" 
                                    step="0.1" 
                                    min="0.5" 
                                    max="5.0" 
                                    class="w-16 rounded p-1 text-sm outline-none text-right border transition focus:border-[var(--accent-color)]" 
                                    style="background-color: var(--bg-color); color: var(--text-color); border-color: color-mix(in srgb, var(--text-color) 15%, transparent);"
                                    bind:value={h.item.fontSize} 
                                />
                                <span class="opacity-60 text-xs">rem</span>
                            </div>

                            <div class="flex items-center gap-3 text-sm select-none">
                                <label class="flex items-center gap-1.5 cursor-pointer">
                                    <input type="checkbox" class="cursor-pointer" style="accent-color: var(--accent-color);" bind:checked={h.item.borderBottom} />
                                    <span class="text-xs">下線</span>
                                </label>

                                <label class="flex items-center gap-1.5 cursor-pointer">
                                    <input type="checkbox" class="cursor-pointer" style="accent-color: var(--accent-color);" bind:checked={h.item.bold} />
                                    <span class="text-xs font-bold">太字</span>
                                </label>

                                <label class="flex items-center gap-1.5 cursor-pointer">
                                    <input type="checkbox" class="cursor-pointer" style="accent-color: var(--accent-color);" bind:checked={h.item.italic} />
                                    <span class="text-xs italic">斜体</span>
                                </label>
                            </div>
                        </div>
                    </div>
                {/each}
            </div>

        </div>
    </div>
</div>
<!-- --- END OF src/components/StyleSettings.svelte --- -->