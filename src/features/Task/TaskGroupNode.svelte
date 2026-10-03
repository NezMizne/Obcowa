<!-- 責務: ワークスペースの未完了タスク一覧において、階層構造（ファイル・見出し）を再帰的に描画し、折りたたみ制御を行う -->
<script lang="ts">
    import { ChevronDown, ChevronRight, FileText, Hash } from 'lucide-svelte';
    import TaskItem from './TaskItem.svelte';
    import type { TaskTreeNode } from '../../lib/task/taskService';
    import { createEventDispatcher } from 'svelte';
    
    export let node: TaskTreeNode;
    export let groupBy: 'file' | 'heading';
    export let isUpdatingTasks: Set<string>;
    export let depth: number = 0; // 現在の階層の深さ（0がルート）
    
    const dispatch = createEventDispatcher();
    
    // デフォルトで展開状態にする
    let isExpanded = true;
    
    function toggle(e: MouseEvent) {
        // ボタンクリックなどでトグルが2重に発火しないよう制御
        isExpanded = !isExpanded;
    }
</script>

<div class="node-container">
    <!-- ヘッダー（見出し・ファイル名） -->
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div class="header" on:click={toggle}>
        <div class="icon-toggle">
            {#if isExpanded}
                <ChevronDown size={16} />
            {:else}
                <ChevronRight size={16} />
            {/if}
        </div>
        
        {#if groupBy === 'file'}
            <button class="filename-btn" 
                on:click|stopPropagation={() => dispatch('openFile', { path: node.path, name: node.name })}
                on:contextmenu|preventDefault|stopPropagation={(e) => dispatch('contextMenu', { event: e, type: 'file', value: node.path })}
            >
                <FileText size={14} /> <span>{node.name}</span>
            </button>
        {:else}
            <div class="heading-title {depth === 0 ? 'root-heading' : 'sub-heading'}"
                 on:contextmenu|preventDefault|stopPropagation={(e) => dispatch('contextMenu', { event: e, type: 'heading', value: node.name })}
            >
                 <span>{node.name}</span>
            </div>
        {/if}
    </div>
    
    <!-- 子要素（タスクと、さらに深い見出し階層） -->
    {#if isExpanded}
        <div class="children" class:no-indent={groupBy === 'file'}>
            
            <!-- この階層のタスク一覧 -->
            <div class="tasks">
                {#each node.tasks as task (`${task.filePath}:${task.lineNumber}`)}
                    <TaskItem 
                        {task} 
                         {isUpdatingTasks}
                        on:change={(e) => dispatch('change', e.detail)}
                    />
                {/each}
            </div>
            
            <!-- さらに深い見出し階層があれば、自分自身（TaskGroupNode）を呼び出す（再帰） -->
            {#each node.children as child (child.id)}
                <svelte:self 
                    node={child} 
                    {groupBy} 
                    {isUpdatingTasks}
                    depth={depth + 1}
                    on:change
                    on:openFile
                    on:contextMenu
                />
            {/each}
        </div>
    {/if}
</div>

<style>
    .node-container {
        margin-bottom: 2px;
    }
    
    .header {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 4px 0;
        cursor: pointer;
        user-select: none;
    }

    .root-heading {
        color: var(--accent-color);
        border-bottom: 1px solid color-mix(in srgb, var(--text-color) 15%, transparent);
    }
    .sub-heading {
        /* アクセントカラーを30%混ぜて、真っ白（文字色）すぎない少し色づいたテキストにする */
        color: color-mix(in srgb, var(--accent-color) 70%, var(--text-color));
    }

    .icon-toggle {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 20px;
        color: color-mix(in srgb, var(--text-color) 60%, transparent);
    }
    
    .filename-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: transparent;
        border: none;
        padding: 2px 4px;
        font-size: 0.9em;
        font-weight: 600;
        color: var(--accent-color);
        cursor: pointer;
        border-bottom: 1px solid color-mix(in srgb, var(--text-color) 15%, transparent);
    }
    
    .heading-title {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 1em;
        font-weight: 600;
    }
    :global(.hash-icon) {
        color: color-mix(in srgb, var(--text-color) 40%, transparent);
    }
    
    .children {
        /* 階層が下がるごとにインデントをつける（線を消し、幅を狭く調整） */
        margin-left: 20px;
        display: flex;
        flex-direction: column;
        border-left: 1px solid color-mix(in srgb, var(--text-color) 10%, transparent);
        gap: 2px;
    }
    
    .no-indent {
        /* ファイル一覧モードの時はインデントを少し広げる（従来の見た目に合わせるため） */
        margin-left: 24px;
    }
    
    .tasks {
        margin-left: 16px; /* タスクを見出しよりもさらに字下げする */
        display: flex;
        flex-direction: column;
        gap: 2px;
    }
</style>