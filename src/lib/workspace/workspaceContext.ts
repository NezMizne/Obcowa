// 責務: workspaceActions Context の識別キー・型契約・型安全な set/get ヘルパーを一元管理する
import { getContext, setContext } from 'svelte';
import type { VirtualNode } from '../tauri/generated';

export interface NodeLike {
    type: string;
    name: string;
    path?: string | null;
    original_path?: string | null;
}

export type TreeVirtualNode =
    | (Extract<VirtualNode, { type: 'Folder' }> & { is_virtual_wrapper?: boolean })
    | Extract<VirtualNode, { type: 'File' }>;

export interface WorkspaceActionsContext {
    removeNode: (targetNode: TreeVirtualNode, ownerId: string) => Promise<void>;
    pinNode: (targetNode: NodeLike) => void;
    unpinNode: (targetNode: NodeLike) => void;
    checkIsPinned: (targetNode: NodeLike) => boolean;
    getClickBehavior: () => boolean;
    saveWorkspace: () => Promise<void>;
    editSmartFolder: (node: TreeVirtualNode) => void;
    openNewFileModal: (dirPath: string, callback: () => void) => void;
    getGlobalSort: () => { by: string; order: string };
    setNodeSort: (node: TreeVirtualNode, by: string, order: string) => void;
}

export const WORKSPACE_ACTIONS_CONTEXT_KEY = Symbol('workspaceActions');

export function setWorkspaceActions(actions: WorkspaceActionsContext): WorkspaceActionsContext {
    return setContext(WORKSPACE_ACTIONS_CONTEXT_KEY, actions);
}

export function getWorkspaceActions(): WorkspaceActionsContext {
    const context = getContext<WorkspaceActionsContext | undefined>(WORKSPACE_ACTIONS_CONTEXT_KEY);
    if (!context) {
        throw new Error('workspaceActions context is not initialized.');
    }
    return context;
}

export function getOptionalWorkspaceActions(): WorkspaceActionsContext | undefined {
    return getContext<WorkspaceActionsContext | undefined>(WORKSPACE_ACTIONS_CONTEXT_KEY);
}
