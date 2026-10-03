<!-- タスク1件分のUI表示と、チェックボックス操作のイベント発火 -->
<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import type { Task } from '../../lib/task/taskService';

    export let task: Task;
    export let isUpdatingTasks: Set<string> = new Set();

    $: isUpdating = isUpdatingTasks.has(`${task.filePath}:${task.lineNumber}`);

    let isChecked = false;

    const dispatch = createEventDispatcher<{ change: { task: Task; completed: boolean } }>();

    function handleCheck() {
        if (!isUpdating) {
            dispatch('change', { task, completed: isChecked });
        }
    }

</script>

<div class="task-item-container">
    <div class="task-item-row" class:disabled={isUpdating}>
        <input 
            type="checkbox" 
            class="task-checkbox" 
            disabled={isUpdating}
            bind:checked={isChecked}
            on:change={handleCheck}
        />
        <div class="task-content">
            <span class="task-text" class:completed={isChecked}>{task.text}</span>
        </div>
    </div>

    <!-- 子タスクがある場合は再帰的に描画 -->
    {#if task.subTasks && task.subTasks.length > 0}
        <div class="sub-tasks">
            {#each task.subTasks as subTask (`${subTask.filePath}:${subTask.lineNumber}`)}
                <svelte:self 
                    task={subTask} 
                    {isUpdatingTasks}
                    on:change
                />
            {/each}
        </div>
    {/if}
</div>

<style>
    .task-item-container {
        display: flex;
        flex-direction: column;
    }

    .task-item-row {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        padding: 6px 8px;
        border-radius: 4px;
        transition: background-color 0.2s;
    }

    .task-item-row.disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .task-checkbox {
        appearance: none;
        -webkit-appearance: none;
        width: 1.2rem;
        height: 1.2rem;
        border: 1.5px solid color-mix(in srgb, var(--text-color) 40%, transparent);
        border-radius: 50%;
        outline: none;
        cursor: pointer;
        margin-top: 2px;
        margin-right: 4px;
        vertical-align: middle;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        position: relative;
        transition: background-color 0.15s ease, border-color 0.15s ease;
        background-color: transparent;
        flex-shrink: 0;
    }

    .task-checkbox:hover:not(:disabled) {
        border-color: var(--accent-color);
    }

    .task-checkbox:checked {
        background-color: var(--accent-color);
        border-color: var(--accent-color);
    }

    .task-checkbox:checked::after {
        content: '';
        width: 0.35rem;
        height: 0.6rem;
        border: solid var(--bg-color); /* 背景色と同色でチェックマーク */
        border-width: 0 2px 2px 0;
        transform: rotate(45deg);
        margin-bottom: 2px;
    }

    .task-content {
        display: flex;
        flex-direction: column;
        gap: 2px;
        flex: 1;
        overflow: hidden;
    }

    .task-text {
        color: var(--text-color);
        font-size: 0.95em;
        line-height: 1.4;
        word-break: break-word;
        user-select: text;
    }

    .task-text.completed {
        text-decoration: line-through;
        opacity: 0.5;
    }

    /* 子タスク用のインデントと左線 */
    .sub-tasks {
        margin-left: 1.2rem;
        padding-left: 0.5rem;
        border-left: 1px solid color-mix(in srgb, var(--text-color) 15%, transparent);
        display: flex;
        flex-direction: column;
    }
    
</style>