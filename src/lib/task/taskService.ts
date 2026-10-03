// Tauriと通信し、タスクの取得および完了処理を行うAPIサービス

import { invoke } from '@tauri-apps/api/core';
import { extractFilePaths } from '../workspace/treeUtils';
import { saveAndUpdateTab } from '../editor/fileManager';

export interface Task {
    filePath: string;
    lineNumber: number;
    text: string;
    originalText: string;
    headings: string[];
    indentLevel?: number;
    fileCreated?: number;
    fileModified?: number;
    subTasks?: Task[]; // 将来のインデント（再帰表示）用
}

export type GroupByOption = 'file' | 'heading';
export type SortOption = 'none' | 'text' | 'created' | 'modified';

export interface TaskTreeNode {
    id: string;
    name: string;        // 見出し名、またはファイル名
    path: string;        // ファイルパス（ファイル単位のグループ化時のみ使用）
     tasks: Task[];
    children: TaskTreeNode[]; // 子階層
}

// 将来のフィルタリング拡張用
export interface TaskScanOptions {
    excludePaths?: string[];
    includePaths?: string[];
    excludeHeadings?: string[]; 
}

/**
 * ワークスペース内の未完了タスクを取得する
 */
export async function fetchWorkspaceTasks(nodes: any[], options?: TaskScanOptions): Promise<Task[]> {
    // 巨大なツリーオブジェクトの送信をやめ、ファイルパスだけを抽出して送付する
    const filePaths = extractFilePaths(nodes);
    try {
        const tasks = await invoke<Task[]>('get_workspace_tasks', { 
            filePaths,
            options: options || null 
        });
        return tasks;
    } catch (error) {
        console.error("Failed to fetch tasks:", error);
        throw new Error("タスクの取得に失敗しました");
    }
}

/**
 * タスクを完了状態にする（対象行の安全な上書き）
 */
export async function completeTaskStatus(task: Task, completed: boolean = true) {
    try {
        // 1. 対象ファイルの最新テキストと更新日時を取得
        const currentContent: string = await invoke('read_file_content', { path: task.filePath });
        const lastModified: number = await invoke('get_file_modified', { path: task.filePath });

        // 2. テキストを行に分割
        const lines = currentContent.split('\n');

        // 💥 追加: 行番号がズレている可能性を考慮し、元のテキストを手掛かりに探し出す
        let targetIndex = task.lineNumber - 1;
        let found = false;

        if (targetIndex >= 0 && targetIndex < lines.length && lines[targetIndex].includes(task.originalText)) {
            found = true; // 記録されていた行番号でピッタリ見つかった場合
        } else {
            // ズレていた場合はファイル全体から検索する
            targetIndex = lines.findIndex(line => line.includes(task.originalText));
            if (targetIndex !== -1) found = true;
        }
        
        if (!found) {
            throw new Error("タスクが見つかりません。ファイルが大幅に書き換えられた可能性があります。");
        }

        const targetLine = lines[targetIndex];
        
        // 💥 変更: `-` だけでなく `*` や `+` のタスクリストにも対応
        const newMark = completed ? '[x]' : '[ ]';
        const updatedLine = targetLine.replace(/([-*+])\s*\[[ xX]\]/, `$1 ${newMark}`);

        if (targetLine === updatedLine) {
            return; 
        }

        lines[targetIndex] = updatedLine;
        const newContent = lines.join('\n');

        // 3. 安全なファイルマネージャー（キュー）経由で保存し、エディタのタブも同期させる
        await saveAndUpdateTab(task.filePath, newContent, lastModified, true);
    } catch (error) {
        console.error("Failed to complete task:", error);
        throw new Error(`タスクの更新に失敗しました: ${error}`);
    }
}

/**
 * タスクのリストを、指定された条件（ファイル単位 / 見出し単位）でグループ化する純粋関数
 */
export function buildTaskTree(
    tasks: Task[],
    groupBy: GroupByOption,
    ignoreH1: boolean
): TaskTreeNode[] {
    const rootNodes: TaskTreeNode[] = [];

    if (groupBy === 'file') {
        const fileMap = new Map<string, TaskTreeNode>();
        for (const task of tasks) {
            if (!fileMap.has(task.filePath)) {
                const fileName = task.filePath.split(/[/\\]/).pop() || 'Unknown';
                const node: TaskTreeNode = { id: `file::${task.filePath}`, name: fileName, path: task.filePath, tasks: [], children: [] };
                fileMap.set(task.filePath, node);
                rootNodes.push(node);
            }
            fileMap.get(task.filePath)!.tasks.push(task);
        }
        return rootNodes;
    }
    
    // 見出しごとの場合
    const noHeadingNode: TaskTreeNode = { id: 'heading::__no_heading__', name: '見出しなし', path: '', tasks: [], children: [] };

    for (const task of tasks) {
        let headings = task.headings || [];
        if (ignoreH1 && headings.length > 0) {
            headings = headings.slice(1);
        }
        const validHeadings = headings.filter(h => h.trim().length > 0);

        if (validHeadings.length === 0) {
            noHeadingNode.tasks.push(task);
            continue;
        }

        let currentLevelNodes = rootNodes;
        let currentIdPath = 'heading';

        for (let i = 0; i < validHeadings.length; i++) {
            const h = validHeadings[i];
            currentIdPath += `::${h}`;
            
            let node = currentLevelNodes.find(n => n.name === h);
            if (!node) {
                node = { id: currentIdPath, name: h, path: '', tasks: [], children: [] };
                currentLevelNodes.push(node);

    }
              
            // 最後の見出し階層ならタスクを追加
            if (i === validHeadings.length - 1) {
                node.tasks.push(task);
            }
            
            currentLevelNodes = node.children;
        }
    }
        if (noHeadingNode.tasks.length > 0) {
        rootNodes.unshift(noHeadingNode); // 見出しなしを先頭に追加
        }

    return rootNodes;

}

//  ソートとネスト解決を行う純粋関数 ---
export function sortTaskTreeNodes(nodes: any[], sortOption: SortOption): any[] {
    if (sortOption === 'none') return nodes;

    return nodes.map(node => {
        const newNode = { ...node };
        
        // 1. ノード内のタスクをソート
        if (newNode.tasks && newNode.tasks.length > 0) {
            newNode.tasks = processTaskSorting(newNode.tasks, sortOption);
        }
        
        // 2. 子グループがある場合は再帰的に処理
        if (newNode.children && newNode.children.length > 0) {
            newNode.children = sortTaskTreeNodes(newNode.children, sortOption);
        }
        return newNode;
    });
}

function processTaskSorting(tasks: Task[], sortOption: SortOption): Task[] {
    // 1. インデントレベルに基づくネスト（親子）の解決
    const rootTasks: Task[] = [];
    const stack: { task: Task; indent: number }[] = [];

    const clonedTasks = tasks.map(t => ({ ...t, subTasks: [] as Task[] }));

    for (const task of clonedTasks) {
        const currentIndent = task.indentLevel || 0;
        
        // 自分より浅い階層の親が見つかるまでスタックを戻す
        while (stack.length > 0 && stack[stack.length - 1].indent >= currentIndent) {
            stack.pop();
        }

        if (stack.length === 0) {
            rootTasks.push(task);
        } else {
            // 親の subTasks に自身を紐付ける
            stack[stack.length - 1].task.subTasks!.push(task);
        }
        stack.push({ task, indent: currentIndent });
    }

    // 2. 親タスクのみをソート（子は親の中に入っているので追従する）
    rootTasks.sort((a, b) => {
        if (sortOption === 'text') {
            return a.text.localeCompare(b.text);
        }
        if (sortOption === 'created') {
            return (b.fileCreated || 0) - (a.fileCreated || 0);
        }
        if (sortOption === 'modified') {
            return (b.fileModified || 0) - (a.fileModified || 0);
        }
        return 0;
    });

    // 3. 既存UIを壊さないよう、フラットな一次元配列に展開して返す
    const flattenTasks = (nodeList: Task[]): Task[] => {
        const flat: Task[] = [];
        for (const node of nodeList) {
            flat.push(node);
            if (node.subTasks && node.subTasks.length > 0) {
                flat.push(...flattenTasks(node.subTasks));
            }
        }
        return flat;
    };

    return flattenTasks(rootTasks);
}