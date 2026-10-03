<!-- 責務: ワークスペースの未完了タスク一覧を表示し、更新を管理する親コンポーネント -->
<script lang="ts">
    import { onMount } from 'svelte';
    import { RefreshCw, CheckCircle2, EyeOff, Library, FileText, Heading1 } from 'lucide-svelte';
    import { invoke } from '@tauri-apps/api/core';
    import { fetchWorkspaceTasks, completeTaskStatus, buildTaskTree, sortTaskTreeNodes, type Task, type GroupByOption, type SortOption } from '../../lib/task/taskService';
    import TaskGroupNode from './TaskGroupNode.svelte';
    import { workspacesStore, openTabs, switchTab, openFileInNewTab } from '../../lib/stores';
    import { getWorkspaceNodes } from '../../lib/workspace/treeUtils';
    import ContextMenu from '../ContextMenu.svelte';
    import type { MenuItem } from '../../lib/workspace/menuUtils';
    import { requestSaveWorkspaces } from '../../lib/workspace/workspaceManager';

    export let workspaceIndex: number;// 呼び出し元から現在のワークスペースパスを受け取る

    let tasks: Task[] = [];
    let isLoading = false;
    let errorMessage = '';
    let updatingTasks = new Set<string>(); // 処理中のタスクを特定する用（filePath + lineNumber）
    let groupBy: GroupByOption = 'heading'; // デフォルトは見出しごと
    let ignoreH1 = true; // デフォルトはH1無視
    let sortOption: SortOption = 'none'; //  ソートオプション

    // 💥 workspacesStoreから現在のツリーを生成し、リアクティブに監視する
    $: targetNodes = ($workspacesStore && $workspacesStore.length > workspaceIndex) 
        ? getWorkspaceNodes($workspacesStore, workspaceIndex)
        : [];

    // コンテキストメニューの状態管理
    let contextMenu = {
        isOpen: false,
        x: 0,
        y: 0,
        targetType: '', // 'file' か 'heading'
        targetValue: '' // ファイルパス か 見出し名
    };

    // 💥 抽出した純粋関数を使ってタスクツリーを構築する
    // 既存の関数をラップし、ソート・ネスト解決を適用する
    $: taskTreeNodes = sortTaskTreeNodes(buildTaskTree(tasks, groupBy, ignoreH1), sortOption);

    // 💥 ツリーが展開されて中身が更新されたら、自動でタスクを再取得する
    $: {
        if (targetNodes && targetNodes.length > 0) {
            loadTasks();
        }
    }

    async function loadTasks() {
        if (!targetNodes || targetNodes.length === 0) return;
        isLoading = true;
        errorMessage = '';
        try {
            const excludes = $workspacesStore[workspaceIndex]?.task_exclude_paths || [];
            const excludeHeadings = $workspacesStore[workspaceIndex]?.task_exclude_headings || [];
            tasks = await fetchWorkspaceTasks(targetNodes, { 
                excludePaths: excludes, 
                excludeHeadings: excludeHeadings 
            });
        } catch (error: any) {
            errorMessage = error.message;
        } finally {
            isLoading = false;
        }
    }

    async function handleTaskChange(event: CustomEvent<{ task: Task; completed: boolean }>) {
        const { task, completed } = event.detail;
        const taskId = `${task.filePath}:${task.lineNumber}`;
        
        updatingTasks.add(taskId);
        updatingTasks = updatingTasks; // Svelteに再描画を通知

        try {
            await completeTaskStatus(task, completed);
            // TODO: エディタで対象ファイルを開いている場合は再読み込みイベントを発火させる等の連携が必要
        } catch (error: any) {
            alert(`エラー: ${error.message}\n一覧を再読み込みします。`);
            await loadTasks(); // 競合などのエラー時は再取得
        } finally {
            updatingTasks.delete(taskId);
            updatingTasks = updatingTasks;
        }
    }
    // 💥 ファイルを新しいタブで開く
    async function openFile(filePath: string, fileName: string) {
    const existingTab = $openTabs.find(t => t.path === filePath);
    if (existingTab) { 
        switchTab(existingTab.id); 
        return; 
    }
    try {
        const content = await invoke<string>('read_file_content', { path: filePath });
        openFileInNewTab(filePath, fileName, content);
    } catch(e) {
        console.error(e);
      }
    }
    
    // 💥 タスク一覧からファイルを除外し、ワークスペース設定を保存する
    async function excludeFileFromTasks(filePath: string) {

        workspacesStore.update(wsList => {
            const currentWs = wsList[workspaceIndex];
            if (!currentWs) return wsList;
            
            if (!currentWs.task_exclude_paths) currentWs.task_exclude_paths = [];
            if (!currentWs.task_exclude_paths.includes(filePath)) {
                currentWs.task_exclude_paths.push(filePath);
            }
            return wsList;
        });

        await requestSaveWorkspaces();
        loadTasks(); // リストを再取得して画面から消す
    }

    // 💥 見出しを除外する処理
    async function excludeHeadingFromTasks(heading: string) {
        workspacesStore.update(wsList => {
            const currentWs = wsList[workspaceIndex];
            if (!currentWs) return wsList;
            
            if (!currentWs.task_exclude_headings) currentWs.task_exclude_headings = [];
            if (!currentWs.task_exclude_headings.includes(heading)) {
                currentWs.task_exclude_headings.push(heading);
            }
            return wsList;
        });

        await requestSaveWorkspaces();
        loadTasks();
    }


    // 右クリックメニューの表示
    function handleContextMenu(e: MouseEvent, type: 'file' | 'heading', value: string) {
        contextMenu = {
            isOpen: true,
            x: e.clientX,
            y: e.clientY,
            targetType: type,
            targetValue: value
        };
    }

    // メニューの中身
    $: menuItems = (contextMenu.targetType === 'file'
        ? [{
              label: "ファイルを除外", icon: EyeOff,
              action: () => excludeFileFromTasks(contextMenu.targetValue)
          }]
        : [{
              label: "見出しを除外", icon: EyeOff,
              action: () => excludeHeadingFromTasks(contextMenu.targetValue)
          }]) as MenuItem[];
</script>

<div class="task-list-container">
    <div class="header">

        <div class="header-top">
            <h3 class="title">
                <CheckCircle2 size={16} />
                未完了タスク: {tasks.length}件
            </h3>

            <div class="actions">

                <!-- ファイルでまとめる(ON) / 見出しでまとめる(OFF) -->
                <button 
                    class="icon-btn {groupBy === 'file' ? 'active' : ''}" 
                    on:click={() => groupBy = groupBy === 'file' ? 'heading' : 'file'} 
                    title={groupBy === 'file' ? "ファイルごとにまとめる" : "見出しごとにまとめる"}
                >
                    <FileText size={16} />
                </button>

                <!-- H1を表示する(ON) / H1を無視する(OFF) -->
                <button 
                    class="icon-btn {!ignoreH1 ? 'active' : ''}" 
                    on:click={() => ignoreH1 = !ignoreH1} 
                    title={!ignoreH1 ? "H1を表示する" : "H1を無視する"}
                >
                    <Heading1 size={16} />
                </button>

                <!-- ソート切り替え -->
                <select class="sort-select" bind:value={sortOption} title="ソート順">
                    <option value="none">標準</option>
                    <option value="text">文言順</option>
                    <option value="modified">更新日順</option>
                    <option value="created">作成日順</option>
                </select>

                <div class="separator-v"></div>

                <button class="icon-btn" on:click={loadTasks} title="リストを再スキャン" disabled={isLoading}>
                    <RefreshCw size={16} class={isLoading ? 'spinning' : ''} />
                </button>
            </div>

        </div>

    </div>

    {#if errorMessage}
        <div class="error-msg">{errorMessage}</div>
    {/if}

    <div class="list-content">
        {#if isLoading && tasks.length === 0}
            <div class="empty-state">スキャン中...</div>
        {:else if tasks.length === 0}
            <div class="empty-state">未完了タスクはありません</div>
        {:else}

           <div class="tree-container">
               {#each taskTreeNodes as node (node.id)}
                    <!-- 💥 新しく作った再帰コンポーネントにツリーのルートノードを渡す -->
                    <TaskGroupNode 
                        {node}
                        {groupBy}
                        isUpdatingTasks={updatingTasks}
                        on:change={handleTaskChange}
                        on:openFile={(e) => openFile(e.detail.path, e.detail.name)}
                        
                        on:contextMenu={(e) => handleContextMenu(e.detail.event, e.detail.type, e.detail.value)}
                    />
               {/each}
           </div>

        {/if}
    </div>
</div>
<!-- 💥 コンテキストメニューの表示 -->
{#if contextMenu.isOpen}
    <ContextMenu 
        x={contextMenu.x} 
        y={contextMenu.y} 
        items={menuItems} 
        onClose={() => contextMenu.isOpen = false} 
    />
{/if}

<style>
    .task-list-container {
        display: flex;
        flex-direction: column;
        height: 100%;
        background-color: var(--menu-bg);
        color: var(--text-color);
        overflow: hidden;
    }

    .header {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 12px 16px;
    }
    .header-top {
        display: flex;
        justify-content: space-between;
        align-items: center;
        width: 100%;
    }

    .title {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0;
        font-size: 0.9em;
        font-weight: 600;
    }

    .actions {
        display: flex;
        align-items: center;
        gap: 4px;
    }

    .icon-btn {
        background: transparent;
        border: none;
        color: color-mix(in srgb, var(--text-color) 70%, transparent);
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .icon-btn.active {
        color: var(--accent-color);
        background-color: color-mix(in srgb, var(--accent-color) 15%, transparent);
    }

    .icon-btn.active:hover {
        background-color: color-mix(in srgb, var(--accent-color) 25%, transparent);
    }

    .icon-btn:hover {
        background-color: var(--active-highlight-bg);
        color: var(--text-color);
    }

    .icon-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .sort-select {
        background-color: var(--bg-color);
        color: var(--text-color);
        border: 1px solid color-mix(in srgb, var(--text-color) 20%, transparent);
        border-radius: 4px;
        padding: 2px 4px;
        font-size: 0.85em;
        outline: none;
        cursor: pointer;
    }

    .separator-v {
        width: 1px;
        height: 16px;
        background-color: color-mix(in srgb, var(--text-color) 20%, transparent);
        margin: 0 4px;
    }

    :global(.spinning) {
        animation: spin 1s linear infinite;
    }

    @keyframes spin {
        100% { transform: rotate(360deg); }
    }

    .list-content {
        flex: 1;
        overflow-y: auto;
        padding: 8px;
    }

    .empty-state {
        text-align: center;
        padding: 32px 16px;
        color: color-mix(in srgb, var(--text-color) 50%, transparent);
        font-size: 0.9em;
    }

    .error-msg {
        background-color: color-mix(in srgb, #ef4444 20%, transparent);
        color: #ef4444; /* エラーは目立たせるため固有色 */
        padding: 8px 12px;
        margin: 8px;
        border-radius: 4px;
        font-size: 0.85em;
    }

    .tree-container {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

</style>