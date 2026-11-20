<!-- 責務: 独立した小ウィンドウでワークスペースの一覧を表示し、選択結果をメイン画面に送信する -->
<script lang="ts">
    import { onMount } from 'svelte';
    import { invoke } from '@tauri-apps/api/core';
    import { getCurrentWindow } from '@tauri-apps/api/window';
    import type { Workspace } from '../../lib/tauri/generated';
    import { APP_EVENTS, emitAppEvent } from '../../lib/tauri/events';

    let localWorkspaces: Workspace[] = [];
    let isLoading = true;

    onMount(async () => {
        try {
            localWorkspaces = await invoke('load_workspaces');
        } catch (e) {
            console.error("ワークスペースの読み込みに失敗しました", e);
        } finally {
            isLoading = false;
        }
    });

    async function selectWorkspace(index: number) {
        // メイン画面に選んだインデックスを通知（これを受け取ったメイン画面が勝手にリロードして表示されます）
        await emitAppEvent(APP_EVENTS.WORKSPACE_SELECTED, { index });
        
        // 自分（ランチャー）を閉じる
        await getCurrentWindow().close();
    }
</script>

<div class="h-screen w-screen bg-[var(--bg-color)] text-[var(--text-color)] overflow-y-auto p-6 select-none">
    <h1 class="text-xl font-bold mb-6 flex items-center gap-2">
        ワークスペースを選択
    </h1>

    {#if isLoading}
        <div class="flex justify-center py-10 opacity-50">読み込み中...</div>
    {:else if localWorkspaces.length === 0}
        <div class="text-center py-10 opacity-50">ワークスペースがありません</div>
    {:else}
        <div class="space-y-3">
            {#each localWorkspaces as ws, i}
                <button 
                    class="w-full text-left p-4 rounded-lg bg-[var(--menu-bg)] hover:bg-[var(--active-highlight-bg)] border border-transparent hover:border-[var(--accent-color)] transition-all flex flex-col gap-1"
                    on:click={() => selectWorkspace(i)}
                >
                    <span class="font-bold text-lg">{ws.name}</span>
                    <span class="text-sm opacity-60">
                        {ws.category || 'カテゴリなし'} 
                        ({ws.nodes?.length || 0} アイテム)
                    </span>
                </button>
            {/each}
        </div>
    {/if}
</div>