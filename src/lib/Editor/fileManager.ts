// 責務: SvelteからRust(Tauri)へのファイル保存リクエストを直列化（キュー管理）し、競合を防ぐ

import { invoke } from '@tauri-apps/api/core';
import { openTabs } from '../stores';

// 保存リクエストを順番に処理するためのプロミスチェーン（キュー）
let saveQueue = Promise.resolve<any>(null);

/**
 * ファイルの保存処理を直列化して実行する。
 * 複数の場所から同時に保存が呼ばれても、順番に一つずつTauriへ送られる。
 */
export function requestSaveFile(path: string, content: string, lastModified: number, force: boolean): Promise<number> {
    const task = saveQueue.then(async () => {
        return await invoke<number>('save_file_content', { path, content, lastModified, force });
    });
    
    // エラーが起きてもキュー自体が壊れず、後続の保存が続くようにする
    saveQueue = task.catch((err) => {
        console.error(`File save error [${path}]:`, err);
        throw err;
    });

    return task;
}

/**
 * ファイルを保存し、もしそのファイルがタブとして開かれていれば Store の情報も最新化する。
 * サイドバーや右クリックメニューなどからの「直接保存」で使用する。
 */
export async function saveAndUpdateTab(path: string, content: string, lastModified: number, force: boolean): Promise<void> {
    const newModified = await requestSaveFile(path, content, lastModified, force);
    
    // 💥 指摘ポイントの修正: 直接プロパティを書き換えず、新しいオブジェクトを作る（イミュータブルな更新）
    openTabs.update(tabs => {
        return tabs.map(t => 
            t.path === path 
                ? { ...t, content, isDirty: false, lastModified: newModified } 
                : t
        );
    });
}