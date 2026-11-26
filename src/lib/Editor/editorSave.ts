// エディタの保存処理、競合ダイアログハンドリングの純粋・抽象化ロジック

import { isSpecialPath } from '../utils/pathUtils';

export interface SaveDependencies {
    saveFileContent: (path: string, content: string, lastModified: number, force: boolean) => Promise<number>;
    getModified: (path: string) => Promise<number>;
    readFileContent: (path: string) => Promise<string>; 
    askConflictResolution: (path: string, localContent: string, remoteContent: string) => Promise<'overwrite' | 'reload' | 'cancel'>;
    saveDashboard?: (workspaceId: string, content: string) => Promise<void>;
    onError?: (message: string) => void;
}

export interface BaseTabData {
    id: string;
    path?: string;
    content: string;
    isDirty: boolean;
    lastModified?: number;
    isConflict?: boolean;
    isDashboard?: boolean;
    workspaceId?: string;
}

/**
 * 指定したタブの保存を実行し、必要に応じて競合解決ダイアログを表示する
 */
export async function saveTabWithConflictCheck<T extends BaseTabData>(
    targetTab: T,
    deps: SaveDependencies,
    updateTab: (updater: (tab: T) => T) => void,
    onDialogStateChange?: (showing: boolean) => void
): Promise<boolean> {
if (!targetTab.isDirty) {
        return true;
    }

    if (targetTab.isDashboard && targetTab.workspaceId) {
        if (!deps.saveDashboard) return false;
        try {
            await deps.saveDashboard(targetTab.workspaceId, targetTab.content);
            updateTab(t => ({
                ...t,
                isDirty: t.content === targetTab.content ? false : t.isDirty,
                isConflict: false
            }));
            return true;
        } catch (e) {
            console.error("Failed to save dashboard", e);
            deps.onError?.(`ダッシュボードの保存に失敗しました: ${String(e)}`);
            return false;
        }
    }

    // 既存のパスなしファイルのスキップ
    if (!targetTab.path || isSpecialPath(targetTab.path)) {
        return true;
    }

    try {
        const newModified = await deps.saveFileContent(
            targetTab.path,
            targetTab.content,
            targetTab.lastModified || 0,
            false
        );
        updateTab(t => ({
            ...t,
            isDirty: t.content === targetTab.content ? false : t.isDirty,
            lastModified: newModified,
            isConflict: false
        }));
        return true;
    } catch (e) {
        if (e === 'CONFLICT') {
            onDialogStateChange?.(true);

            // ダイアログでの差分表示用に最新の外部データを取得する
            let remoteContent = "";
            try {
                remoteContent = await deps.readFileContent(targetTab.path);
            } catch (err) {
                remoteContent = "（外部ファイルの読み込みに失敗しました）";
            }

            const resolution = await deps.askConflictResolution(targetTab.path, targetTab.content, remoteContent);

            if (resolution === 'overwrite') {
                try {
                    const newModified = await deps.saveFileContent(
                        targetTab.path,
                        targetTab.content,
                        targetTab.lastModified || 0,
                        true
                    );
                    updateTab(t => ({
                        ...t,
                        isDirty: t.content === targetTab.content ? false : t.isDirty,
                        lastModified: newModified,
                        isConflict: false
                    }));
                    onDialogStateChange?.(false);
                    return true;
                } catch (err) {
                    console.error("Failed to overwrite file:", err);
                    deps.onError?.(`ファイルの上書き保存に失敗しました: ${String(err)}`);
                    onDialogStateChange?.(false);
                    return false;
                }

            } else if (resolution === 'reload') {
                try {
                    const latestContent = await deps.readFileContent(targetTab.path);
                    const newModified = await deps.getModified(targetTab.path);

                    updateTab(t => ({
                        ...t,
                        content: latestContent,
                        isDirty: false,
                        lastModified: newModified,
                        isConflict: false
                    }));
                } catch (err) {
                    console.error("Failed to reload file:", err);
                    deps.onError?.(`外部ファイルの再読み込みに失敗しました: ${String(err)}`);
                }
                onDialogStateChange?.(false);
                return false;
            } else {
                // cancel（保留）の場合
                updateTab(t => ({ ...t, isConflict: true }));
                onDialogStateChange?.(false);
                return false;
            }
        }
        console.error("Failed to save file:", e);
        deps.onError?.(`ファイルの保存に失敗しました: ${String(e)}`);
        return false;
    }
}