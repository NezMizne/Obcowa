// プレビュー内のノート埋め込みプレースホルダーを検出し、非同期でコンテンツを取得して描画する

import { invoke } from '@tauri-apps/api/core';
import { get } from 'svelte/store';
import { workspacesStore, currentWorkspaceIndex } from '../stores';
import { getWorkspaceNodes, buildFilenameIndex } from '../workspace/treeUtils';
import { parseMarkdown, sanitizeHtml } from '../../components/Editor/markdownSetup';

const LINK_ICON_SVG = `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>`;

/**
 * DOM内のプレースホルダーを探し、ノートのコンテンツを非同期で埋め込む
 * @param container 探索対象のDOMコンテナ
 * @param currentFilePath 現在開いているファイルのパス
 * @param embedStack 循環参照を防ぐためのパス履歴スタック
 */
export async function loadEmbedsInDom(container: HTMLElement, currentFilePath: string, embedStack: string[] = []) {
    const placeholders = container.querySelectorAll<HTMLElement>('.obsidian-embed-placeholder');
    if (placeholders.length === 0) return;

    const wsList = get(workspacesStore);
    const wsIndex = get(currentWorkspaceIndex);
    const targetNodes = getWorkspaceNodes(wsList, wsIndex, true);
    const index = buildFilenameIndex(targetNodes);

    // 自身のファイルパスをスタックに追加（循環参照チェック用）
    const newStack = [...embedStack, currentFilePath];

    for (const placeholder of placeholders) {
        const targetName = placeholder.getAttribute('data-embed-target');
        const heading = placeholder.getAttribute('data-embed-heading');
        const blockId = placeholder.getAttribute('data-embed-block');
        if (!targetName) continue;

        // 見た目のクラスを確定済みのものに切り替え
        placeholder.classList.remove('obsidian-embed-placeholder');
        placeholder.classList.add('obsidian-embed');

        try {
            const exactMatches = index.get(targetName.trim().toLowerCase()) || [];
            
            if (exactMatches.length === 1) {
                const node = exactMatches[0];
                const filePath = node.path || node.original_path;

                // 循環参照チェック
                if (newStack.includes(filePath)) {
                    placeholder.innerHTML = `<div class="obsidian-embed-error">循環参照が検出されました: ${targetName}</div>`;
                    continue;
                }

                // ファイルの中身を読み込んでパース（埋め込み内はプロパティカード非表示）
                const contentStr: string = await invoke('read_file_content', { path: filePath });
                
                const rawHtml = await parseMarkdown(contentStr, filePath, { 
                    showProperties: false,
                    extractHeading: heading || undefined,
                    extractBlock: blockId || undefined
                });
                const safeHtml = sanitizeHtml(rawHtml);


                // ブロックID指定時はヘッダー（ファイル名・見出し）を非表示にし、文章のみ展開（Obsidian仕様準拠）
                if (blockId) {
                    placeholder.innerHTML = `
                        <div class="obsidian-embed-content editor-preview">${safeHtml}</div>
                    `;
                } else {
                    let titleDisplay = targetName;
                    if (heading) titleDisplay += ` > ${heading}`;

                    placeholder.innerHTML = `
                        <div class="obsidian-embed-header">
                            <span class="obsidian-embed-title obsidian-wiki-link" data-wiki-target="${targetName}">${titleDisplay}</span>
                            <a href="#" class="obsidian-embed-link obsidian-wiki-link" data-wiki-target="${targetName}" title="開く">${LINK_ICON_SVG}</a>
                        </div>
                        <div class="obsidian-embed-content editor-preview">${safeHtml}</div>
                    `;
                }

                // 埋め込んだコンテンツの中に「さらに埋め込み」があるか再帰的に処理
                const contentContainer = placeholder.querySelector<HTMLElement>('.obsidian-embed-content');
                if (contentContainer) {
                    // awaitすると直列になって描画が遅くなるため、あえて非同期に投げて並行処理させる
                    loadEmbedsInDom(contentContainer, filePath, newStack);
                }
            } else if (exactMatches.length > 1) {
                placeholder.innerHTML = `<div class="obsidian-embed-error">複数のファイルがヒットしました: ${targetName}</div>`;
            } else {
                placeholder.innerHTML = `<div class="obsidian-embed-error">ファイルが見つかりません: ${targetName}</div>`;
            }
        } catch (e) {
            console.error("[Embed] Failed to load embed:", e);
            placeholder.innerHTML = `<div class="obsidian-embed-error">読み込みエラー: ${targetName}</div>`;
        }
    }
}