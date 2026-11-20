// 責務: Tauri ウィンドウ間イベントの名前・ペイロード型・型安全な送受信ラッパーを一元管理する
import { emit, listen, type UnlistenFn } from '@tauri-apps/api/event';

export const APP_EVENTS = {
    WORKSPACES_UPDATED: 'workspaces-updated',
    WORKSPACE_SELECTED: 'workspace-selected',
} as const;

export interface AppEventMap {
    [APP_EVENTS.WORKSPACES_UPDATED]: void;
    [APP_EVENTS.WORKSPACE_SELECTED]: { index: number };
}

export type AppEventName = keyof AppEventMap;

export async function emitAppEvent<K extends AppEventName>(
    event: K,
    ...args: AppEventMap[K] extends void ? [] : [payload: AppEventMap[K]]
): Promise<void> {
    if (args.length > 0) {
        await emit(event, args[0]);
    } else {
        await emit(event);
    }
}

export async function listenAppEvent<K extends AppEventName>(
    event: K,
    handler: (payload: AppEventMap[K]) => void | Promise<void>
): Promise<UnlistenFn> {
    return listen<AppEventMap[K]>(event, (e) => handler(e.payload));
}
