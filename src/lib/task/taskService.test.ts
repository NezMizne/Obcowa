// taskServiceの単体テスト

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import type { VirtualNode } from '../tauri/generated';
import {
    fetchWorkspaceTasks,
    completeTaskStatus,
    buildTaskTree,
    sortTaskTreeNodes,
    type Task,
    type TaskTreeNode
} from './taskService';

const invokeMock = vi.mocked(invoke);

const dummyNodes: VirtualNode[] = [
    {
        type: 'File',
        name: 'path.md',
        path: '/dummy/path.md',
        created: 0,
        modified: 0
    }
];

describe('taskService', () => {
    beforeEach(() => {
        invokeMock.mockReset();
        invokeMock.mockImplementation(async (cmd: string, args?: unknown) => {
            const payload = (args ?? {}) as Record<string, unknown>;
            if (cmd === 'get_workspace_tasks') {
                return [
                    {
                        filePath: '/dummy/path.md',
                        lineNumber: 2,
                        text: 'Test Task',
                        originalText: '- [ ] Test Task',
                        headings: ['H1 Title', 'H2 Subtitle']
                    }
                ];
            }
            if (cmd === 'read_file_content') {
                if (payload.path === '/dummy/missing.md') {
                    throw new Error('File not found');
                }
                return '# Title\n- [ ] Test Task\n- [ ] Another Task';
            }
            if (cmd === 'get_file_modified') {
                return 1000;
            }
            if (cmd === 'save_file_content') {
                return 2000;
            }
            return undefined;
        });
    });

    it('fetchWorkspaceTasksが正しくタスクを返すこと', async () => {
        const tasks = await fetchWorkspaceTasks(dummyNodes);
        expect(tasks.length).toBe(1);
        expect(tasks[0].text).toBe('Test Task');
        expect(invokeMock).toHaveBeenCalledWith('get_workspace_tasks', {
            filePaths: ['/dummy/path.md'],
            options: null
        });
    });

    it('将来の拡張オプションを渡してもエラーにならないこと', async () => {
        const options = { excludePaths: ['/dummy/workspace/node_modules'] };
        const tasks = await fetchWorkspaceTasks(dummyNodes, options);
        expect(tasks.length).toBe(1);
        expect(invokeMock).toHaveBeenCalledWith('get_workspace_tasks', {
            filePaths: ['/dummy/path.md'],
            options
        });
    });

    it('completeTaskStatusが対象行を更新し、save_file_contentを呼び出して成功すること', async () => {
        const task: Task = {
            filePath: '/dummy/path.md',
            lineNumber: 2,
            text: 'Test Task',
            originalText: '- [ ] Test Task',
            headings: []
        };
        await expect(completeTaskStatus(task)).resolves.toBeUndefined();
        expect(invokeMock).toHaveBeenCalledWith('save_file_content', {
            path: '/dummy/path.md',
            content: '# Title\n- [x] Test Task\n- [ ] Another Task',
            lastModified: 1000,
            force: true
        });
    });

    it('completeTaskStatusが行未検出・Rustエラーをキャッチして例外を投げること', async () => {
        const missingTask: Task = {
            filePath: '/dummy/path.md',
            lineNumber: 999,
            text: 'Error Task',
            originalText: '- [ ] Error Task',
            headings: []
        };
        await expect(completeTaskStatus(missingTask)).rejects.toThrow(/タスクの更新に失敗しました/);

        const missingFileTask: Task = {
            filePath: '/dummy/missing.md',
            lineNumber: 1,
            text: 'Missing File Task',
            originalText: '- [ ] Missing File Task',
            headings: []
        };
        await expect(completeTaskStatus(missingFileTask)).rejects.toThrow(/タスクの更新に失敗しました/);
    });
    
    describe('buildTaskTree', () => {
        const mockTasks: Task[] = [
            { filePath: '/fileA.md', lineNumber: 1, text: 'Task 1', originalText: '', headings: ['H1', 'H2'] },
            { filePath: '/fileB.md', lineNumber: 2, text: 'Task 2', originalText: '', headings: ['H1', 'H2'] },
            { filePath: '/fileA.md', lineNumber: 3, text: 'Task 3', originalText: '', headings: [] },
        ];

        it('ファイル単位で正しくグループ化されること', () => {

            const nodes = buildTaskTree(mockTasks, 'file', false);
            expect(nodes.length).toBe(2);
            
            const fileANode = nodes.find(n => n.id === 'file::/fileA.md');
            expect(fileANode?.tasks.length).toBe(2);
            expect(fileANode?.children.length).toBe(0);

        });

        it('見出し単位で階層化され、マージされること', () => {
            const nodes = buildTaskTree(mockTasks, 'heading', false);
            expect(nodes.length).toBe(2); // "見出しなし" と "H1"
            
            const noHeadingNode = nodes.find(n => n.id === 'heading::__no_heading__');
            expect(noHeadingNode?.tasks.length).toBe(1);
            
            const h1Node = nodes.find(n => n.name === 'H1');
            expect(h1Node?.children.length).toBe(1); // H2
            
            const h2Node = h1Node?.children[0];
            expect(h2Node?.name).toBe('H2');
            expect(h2Node?.tasks.length).toBe(2); // Task 1 (fileA), Task 2 (fileB)

        });

        it('H1を無視する設定が機能すること', () => {
            const nodes = buildTaskTree(mockTasks, 'heading', true);
            
            const h2Node = nodes.find(n => n.name === 'H2');
            expect(h2Node).toBeDefined(); // H1が除去され、H2がルートにきている
            expect(h2Node?.tasks.length).toBe(2);
        });
    });
});

describe('Task Sorting and Nesting', () => {
    it('ソート時、子タスクが親タスクのsubTasksに追従してツリー構造のまま再帰ソートされること', () => {
        const mockTasks: Task[] = [
            { text: 'B 親タスク', indentLevel: 0, fileCreated: 1, headings: [], filePath: '', lineNumber: 1, originalText: '' },
            { text: 'Bの子タスク2', indentLevel: 4, fileCreated: 1, headings: [], filePath: '', lineNumber: 2, originalText: '' },
            { text: 'Bの子タスク1', indentLevel: 4, fileCreated: 1, headings: [], filePath: '', lineNumber: 3, originalText: '' },
            { text: 'A 親タスク', indentLevel: 0, fileCreated: 2, headings: [], filePath: '', lineNumber: 4, originalText: '' },
        ];

        const mockTreeNodes: TaskTreeNode[] = [{ id: 'group1', name: 'Group 1', path: '', tasks: mockTasks, children: [] }];

        // 文言順（text）でソート（親は A -> B、B の subTasks 内は 1 -> 2 の順になる）
        const result = sortTaskTreeNodes(mockTreeNodes, 'text') as TaskTreeNode[];
        const sortedTasks = result[0].tasks;

        expect(sortedTasks.length).toBe(2);
        expect(sortedTasks[0].text).toBe('A 親タスク');
        expect(sortedTasks[0].subTasks).toEqual([]);
        expect(sortedTasks[1].text).toBe('B 親タスク');
        expect(sortedTasks[1].subTasks?.map(t => t.text)).toEqual(['Bの子タスク1', 'Bの子タスク2']);
    });
});