// Markdown文字列や独自ウィジェットなどを安全なHTMLに変換する

import DOMPurify from 'dompurify';
import { COPY_ICON_SVG } from './previewExtensions';
import { parseDataviewQuery } from '../../lib/utils/queryParser';

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkFrontmatter from 'remark-frontmatter';
import remarkRehype from 'remark-rehype';
import rehypeRaw from 'rehype-raw';
import rehypeStringify from 'rehype-stringify';
import remarkBreaks from 'remark-breaks';
import { visit } from 'unist-util-visit';
import type { Parent } from 'unist';
import type { Root as MdastRoot, Text, HTML, Code, Heading, Yaml } from 'mdast';
import type { Root as HastRoot, Element as HastElement } from 'hast';


const FRONTMATTER_REGEX = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
/**
 * BOMやフロントマター(メタデータ)を除去する（外部モジュール参照用）
 */
export function removeFrontmatter(content: string) {
        return content.replace(FRONTMATTER_REGEX, '');
}


// Callout用のアイコン定義 (LucideのSVGをベースに作成)
const CALLOUT_ICONS: Record<string, string> = {
    info: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`,
    note: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.17 3.23a2.83 2.83 0 0 0-4 0l-14 14v4h4l14-14a2.83 2.83 0 0 0 0-4z"></path><path d="M16 5l3 3"></path></svg>`,
    warning: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
    success: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`,
    error: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"></polygon><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`,
    question: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
    tip: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path></svg>`,
    quote: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"></path><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"></path></svg>`,
    bug: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="8" height="14" x="8" y="6" rx="4"></rect><path d="m19 7-3 2"></path><path d="m5 7 3 2"></path><path d="m19 19-3-2"></path><path d="m5 19 3-2"></path><path d="M20 13h-4"></path><path d="M4 13h4"></path><path d="m10 4 1 2"></path><path d="m14 4-1 2"></path></svg>`,
    example: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>`
};


/**
 * [AST Plugin] ユーザ入力の生HTMLタグを安全なテキストにエスケープ（既存のpreprocess互換）
 */
function remarkEscapeUserHtml() {
    return (tree: MdastRoot) => {
        visit(tree, 'html', (node: HTML) => {
            const textNode = node as unknown as Text;
            textNode.type = 'text';
            textNode.value = node.value.replace(/</g, "&lt;");
        });
    };
}

/**
 * [AST Plugin] フロントマターYAMLを抽出し、プロパティカードのHTMLに置換する
 */
function remarkPropertiesCard(options: { showProperties: boolean }) {
    return (tree: MdastRoot) => {
        let yamlNodeIndex = -1;
        let yamlContent = '';

        visit(tree, 'yaml', (node: Yaml, index: number | undefined) => {
            if (yamlNodeIndex === -1 && index !== undefined) {
                yamlNodeIndex = index;
                yamlContent = node.value;
            }
        });

        if (yamlNodeIndex !== -1) {
            if (options.showProperties) {
                const html = renderPropertiesCard(yamlContent);
                tree.children.splice(yamlNodeIndex, 1, { type: 'html', value: html } as HTML);
            } else {
                tree.children.splice(yamlNodeIndex, 1);
            }
        }
    };
}

 /**
 * [AST Plugin] 埋め込み用に、指定された「見出し」または「ブロックID」のみを抽出し、他を全て削除する
 */
function remarkExtractContent(options: { extractHeading?: string; extractBlock?: string }) {
    return (tree: MdastRoot) => {
        if (!options.extractHeading && !options.extractBlock) return;

        if (options.extractBlock) {
            let targetNode: any = null;
            // ツリー全体から末尾に ^block-id を持つテキストノードを探す
            visit(tree, 'text', (node: Text, index, parent) => {
                if (node.value.match(new RegExp(`\\s+\\^${options.extractBlock}$`))) {
                    // 親ノード（段落やリストアイテム等）を抽出対象にする
                    targetNode = parent;
                }
            });
            tree.children = targetNode ? [targetNode] : [];
            return;
        }

        if (options.extractHeading) {
            let capturing = false;
            let targetDepth = 0;
            const extractedNodes = [];

            for (const node of tree.children) {
                if (node.type === 'heading') {
                    const headingNode = node as Heading;
                    // 見出しのテキストを抽出
                    const headingText = headingNode.children
                        .filter(c => c.type === 'text' || c.type === 'inlineCode')
                        .map(c => (c as any).value).join('');

                    if (capturing) {
                        // 同じか上のレベルの見出しが来たら抽出終了
                        if (headingNode.depth <= targetDepth) break;
                    } else if (headingText.trim() === options.extractHeading) {
                        capturing = true;
                        targetDepth = headingNode.depth;
                    }
                }
                if (capturing) extractedNodes.push(node);
            }
            tree.children = extractedNodes;
        }
    };
}

/**
 * [AST Plugin] プレビュー上でブロックIDマーカー（^block-id）を非表示にする
 */
function remarkHideBlockIds() {
    return (tree: MdastRoot) => {
        visit(tree, 'text', (node: Text) => {
            node.value = node.value.replace(/\s+\^[A-Za-z0-9-]+$/, '');
        });
    };
}


/**
 * [AST Plugin] Obsidian独自記法（Callout）のパース
 * 引用ブロック（blockquote）の先頭が `[!type]` で始まる場合にコールアウトのHTML構造に変換する
 */
function remarkCallouts() {
    return (tree: MdastRoot) => {
        visit(tree, 'blockquote', (node: any, index, parent) => {
            if (!node.children || node.children.length === 0) return;
            
            const firstChild = node.children[0];
            if (firstChild.type !== 'paragraph' || !firstChild.children || firstChild.children.length === 0) return;
            
            const firstTextNode = firstChild.children[0];
            if (firstTextNode.type !== 'text') return;
            
            // 例: "[!info]- カスタムタイトル" にマッチ
            const match = firstTextNode.value.match(/^\[!([A-Za-z0-9_-]+)\]([+-]?)(?:[ \t]+([^\n]*))?(?:\n|$)/);
            if (!match) return;
            
            const calloutType = match[1].toLowerCase();
            const fold = match[2]; 
            const title = match[3]?.trim() || calloutType.charAt(0).toUpperCase() + calloutType.slice(1);
            
            // 元のテキストからメタデータを削除
            firstTextNode.value = firstTextNode.value.slice(match[0].length);
            
            // 空になったテキストノードや段落をクリーンアップ
            if (firstTextNode.value === '') firstChild.children.shift();
            if (firstChild.children.length === 0) node.children.shift();

            const iconSvg = CALLOUT_ICONS[calloutType] || CALLOUT_ICONS['info'];

            // hast (HTML変換) 用のプロパティを付与して div に変える
            node.data = node.data || {};
            node.data.hName = 'div';
            node.data.hProperties = {
                className: ['obsidian-callout'],
                'data-callout': calloutType
            };
            if (fold) {
                node.data.hProperties['data-callout-fold'] = fold;
                if (fold === '-') node.data.hProperties.className.push('is-collapsed');
            }

            const titleHtml = `
                <div class="callout-title" dir="auto">
                    <div class="callout-icon">${iconSvg}</div>
                    <div class="callout-title-inner">${title}</div>
                    ${fold ? `<div class="callout-fold"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg></div>` : ''}
                </div>
            `;
            
            // 残りの子要素（本文）を div でラップする
            const contentNode = {
                type: 'blockquote', // hNameで上書きされるためダミー
                data: {
                    hName: 'div',
                    hProperties: { className: ['callout-content'] }
                },
                children: node.children
            };
            
            node.children = [ { type: 'html', value: titleHtml }, contentNode ];
        });
    };
}

/**
 * [AST Plugin] Obsidian独自記法（ハイライト, 画像, Wikiリンク）のパース
 */
function remarkObsidianExtensions() {
    return (tree: MdastRoot) => {
        visit(tree, 'text', (node: Text, index: number | undefined, parent: Parent | undefined) => {
            if (!parent || index === undefined) return;
            
            const text = node.value;
            const regex = /(==[\s\S]+?==|!\[\[[^\]]+\]\]|\[\[[^\]]+\]\])/g;
            let lastIndex = 0;
            let match;
            const newNodes: (Text | HTML)[] = [];

            while ((match = regex.exec(text)) !== null) {
                if (match.index > lastIndex) {
                    newNodes.push({ type: 'text', value: text.slice(lastIndex, match.index) });
                }

                const matchedStr = match[0];
                if (matchedStr.startsWith('==') && matchedStr.endsWith('==')) {
                    const innerText = matchedStr.slice(2, -2);
                    const formattedText = innerText.replace(/\r?\n/g, '<br>');
                    newNodes.push({
                        type: 'html',
                        value: `<mark class="obsidian-highlight">${formattedText}</mark>`
                    });
                } else if (matchedStr.startsWith('![[') && matchedStr.endsWith(']]')) {
                    const innerText = matchedStr.slice(3, -2);
                    const parts = innerText.split('|');

                    // ファイル名、見出し(#)、ブロックID(^)を分解
                    const linkMatch = parts[0].match(/^([^#\^]+)(?:#([^#\^]+))?(?:\^([^#\^]+))?/);
                    const rawTarget = linkMatch ? linkMatch[1].trim() : parts[0].trim();
                    const heading = linkMatch && linkMatch[2] ? linkMatch[2].trim() : '';
                    const blockId = linkMatch && linkMatch[3] ? linkMatch[3].trim() : '';

                    const targetName = rawTarget.split(/[/\\]/).pop() || rawTarget; // パスを除去
                    const sizeAttr = parts.length > 1 ? ` width="${parts[1].trim()}"` : ' class="max-w-full h-auto"';

                    // 画像ファイルかどうかの簡易判定
                    const isImage = /\.(png|jpe?g|gif|svg|webp|bmp)$/i.test(targetName);
                    
                    if (isImage) {
                        newNodes.push({
                            type: 'html',
                            value: `<img data-img-filename="${targetName}"${sizeAttr} alt="${targetName}" style="border-radius: 4px; display: inline-block; margin: 0.5rem 0; min-height: 40px; min-width: 40px; background-color: var(--active-highlight-bg);" />`
                        });
                    } else {
                        const headingAttr = heading ? ` data-embed-heading="${heading}"` : '';
                        const blockAttr = blockId ? ` data-embed-block="${blockId}"` : '';
                        newNodes.push({
                            type: 'html',
                            value: `<div class="obsidian-embed-placeholder" data-embed-target="${targetName}"${headingAttr}${blockAttr}></div>`
                        });
                    }
                } else if (matchedStr.startsWith('[[') && matchedStr.endsWith(']]')) {
                    const innerText = matchedStr.slice(2, -2);
                    const parts = innerText.split('|');

                    const linkMatch = parts[0].match(/^([^#\^]+)(?:#([^#\^]+))?(?:\^([^#\^]+))?/);
                    const target = linkMatch ? linkMatch[1].trim() : parts[0].trim();
                    const displayText = parts[1] || parts[0];

                    newNodes.push({
                        type: 'html',
                        value: `<a href="#" class="obsidian-wiki-link" data-wiki-target="${target}">${displayText}</a>`
                    });
                }
                lastIndex = regex.lastIndex;
            }

            if (lastIndex < text.length) {
                newNodes.push({ type: 'text', value: text.slice(lastIndex) });
            }

            if (newNodes.length > 0) {
                parent.children.splice(index, 1, ...newNodes);
                return index + newNodes.length; // 追加した分だけインデックスを進める
            }
        });
    };
}


 /**
 * [AST Plugin] 本文中の #タグ をパース
 * 直前が行頭または空白である場合のみマッチさせ、見出しやURL内アンカーの誤爆を防ぎます
 */
function remarkTags() {
    return (tree: MdastRoot) => {
        visit(tree, 'text', (node: Text, index: number | undefined, parent: Parent | undefined) => {
            if (!parent || index === undefined) return;
            
            const text = node.value;
            // \p{L} = 文字全般, \p{N} = 数字
            const regex = /(^|\s)#([\p{L}\p{N}_\-\/]+)/gu;
            let lastIndex = 0;
            let match;
            const newNodes: (Text | HTML)[] = [];

            while ((match = regex.exec(text)) !== null) {
                if (match.index > lastIndex) {
                    newNodes.push({ type: 'text', value: text.slice(lastIndex, match.index) });
                }

                // 行頭以外のマッチ時の「直前の空白」を保持
                if (match[1]) {
                    newNodes.push({ type: 'text', value: match[1] });
                }

                const tagName = match[2];
                newNodes.push({
                    type: 'html',
                    value: `<span class="obsidian-tag" data-tag="${tagName}">#${tagName}</span>`
                });

                lastIndex = regex.lastIndex;
            }

            if (lastIndex < text.length) {
                newNodes.push({ type: 'text', value: text.slice(lastIndex) });
            }

            if (newNodes.length > 0) {
                parent.children.splice(index, 1, ...newNodes);
                return index + newNodes.length; 
            }
        });
    };
}


/**
 * [AST Plugin] 見出しに折りたたみ用トグルを付与
 */
function remarkHeadings() {
    return (tree: MdastRoot) => {
        visit(tree, 'heading', (node: Heading) => {
            node.children.unshift({
                type: 'html',
                value: '<span class="heading-toggle" title="折りたたみ"></span>'
            } as HTML);
        });
    };
}

/**
 * [AST Plugin] コードブロックのパース（ウィジェットやコピーボタンラッパーの付与）
 */
function remarkCodeBlocks() {
    return (tree: MdastRoot) => {
        visit(tree, 'code', (node: Code, index: number | undefined, parent: Parent | undefined) => {
            if (!parent || index === undefined) return;
            const lang = node.lang || '';

            // ダッシュボードウィジェット判定
            let query = '';
            let sortKey = '';
            let sortOrder = '';
            let isWidget = false;

            if (lang.startsWith('obcowa-search')) {
                const match = lang.match(/obcowa-search\((.*?)\)/);
                query = match ? match[1] : '';
                isWidget = true;
            } else if (lang === 'search') {
                const parsed = parseDataviewQuery(node.value);
                query = parsed.query;
                sortKey = parsed.sortKey;
                sortOrder = parsed.sortOrder;
                isWidget = true;
            }

            if (isWidget) {
                parent.children.splice(index, 1, {
                    type: 'html',
                    value: `<div class="dashboard-widget" data-widget-type="search" data-query="${query}" data-sort-key="${sortKey}" data-sort-order="${sortOrder}"></div>`
                } as HTML);
                return index + 1;
            }

            // Mermaidの判定
            if (lang === 'mermaid') {
                const codeContent = node.value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                parent.children.splice(index, 1, {
                    type: 'html',
                    value: `<div class="obsidian-mermaid-placeholder" style="display: none;">${codeContent}</div>`
                } as HTML);
                return index + 1;
            }

            // 通常のコードブロック
            const matchedLang = lang.match(/\S*/)?.[0] || '';
            const codeContent = node.value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            
            parent.children.splice(index, 1, {
                type: 'html',
                value: `
                <div class="code-block-wrapper">
                    <button type="button" class="code-copy-btn" title="コードをコピー">${COPY_ICON_SVG}</button>
                    <pre><code class="language-${matchedLang}">${codeContent}</code></pre>
                </div>
                `
            } as HTML);
            return index + 1;
        });
    };
}

/**
 * [AST Plugin] GFMのタスクリストを既存のCSSに合わせた構造に整形 (Rehype/HASTフェーズ)
 */
function rehypeTaskLists() {
    return (tree: HastRoot) => {
        visit(tree, 'element', (node: HastElement) => {
            if (node.tagName === 'li' && node.properties?.className && Array.isArray(node.properties.className) && node.properties.className.includes('task-list-item')) {

                // 1. 直下にある邪魔な <p> を解体（unwrap）して中身を li 直下に出す
                let flattenedChildren: any[] = [];
                for (const child of node.children) {
                    if (child.type === 'element' && child.tagName === 'p') {
                        flattenedChildren.push(...(child.children || []));
                    } else {
                        flattenedChildren.push(child);
                    }
                }
                node.children = flattenedChildren;
                
                // 2. 綺麗になった構造で input を探し、スタイル用クラスを付与
                const inputIndex = node.children.findIndex((c) => c.type === 'element' && c.tagName === 'input' && c.properties?.type === 'checkbox');

                if (inputIndex !== -1) {
                    const inputNode = node.children[inputIndex] as HastElement;
                    if (inputNode.properties) {
                        delete inputNode.properties.disabled;
                        inputNode.properties.className = ['task-checkbox'];
                    }
                    
                    const contentChildren = node.children.slice(inputIndex + 1);
                    const spanNode: HastElement = {
                        type: 'element',
                        tagName: 'span',
                        properties: { className: ['task-content'] },
                        children: contentChildren
                    };
                    node.children = [...node.children.slice(0, inputIndex + 1), spanNode];
                }
            }
        });
    };
}


// 折りたたみ用の矢印アイコン (下向きChevron)
const CHEVRON_DOWN_SVG = `<svg class="properties-toggle-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`;

/**
 * フロントマターを解析し、Obsidian風のプロパティカードHTMLを生成する
 */
function renderPropertiesCard(yamlText: string): string {

    const lines = yamlText.split('\n');
    const properties: { key: string; values: string[] }[] = [];
    let currentProp: { key: string; values: string[] } | null = null;

    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;

        // YAMLの複数行リスト（- タグ名）の処理
        if (line.startsWith('-')) {
            const val = line.replace(/^-\s*/, '').trim();
            if (currentProp) {
                currentProp.values.push(val);
            }
            continue;
        }

        const colonIndex = line.indexOf(':');
        if (colonIndex !== -1) {
            const key = line.slice(0, colonIndex).trim();

            const rest = line.slice(colonIndex + 1).trim();
            currentProp = { key, values: [] };
            properties.push(currentProp);

            if (rest) {
                // [tag1, tag2] のようなインライン配列
                if (rest.startsWith('[') && rest.endsWith(']')) {
                    const items = rest.slice(1, -1).split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
                    currentProp.values.push(...items);
                } else {
                    currentProp.values.push(rest.replace(/^['"]|['"]$/g, ''));
                }
            }
        }
    }

    let rowsHtml = '';
    for (const prop of properties) {
        const isTag = prop.key.toLowerCase() === 'tags' || prop.key.toLowerCase() === 'tag';
        let valuesHtml = '';

        if (isTag) {
            // タグは # を付けたバッジにする
            valuesHtml = prop.values.map(v => {
                const tagText = v.startsWith('#') ? v : `#${v}`;
                return `<span class="obsidian-property-tag" data-tag="${v}">${tagText}</span>`;
            }).join('');
        } else {
            valuesHtml = prop.values.map(v => `<span class="obsidian-property-text">${v}</span>`).join(', ');
        }

        rowsHtml += `
        <div class="obsidian-property-row">
            <div class="obsidian-property-key">${prop.key}</div>
            <div class="obsidian-property-value">${valuesHtml}</div>
        </div>`;
    }

    return `
    <div class="obsidian-properties-card">
        <div class="obsidian-properties-header" title="プロパティを折りたたむ">
            ${CHEVRON_DOWN_SVG}
            <span class="obsidian-properties-title">PROPERTIES</span>
        </div>
        <div class="obsidian-properties-body">${rowsHtml}</div>
    </div>\n
    `;
}

/**
 * 危険なスクリプト等を除去した安全なHTMLを生成する
 */
export function sanitizeHtml(rawHtml: string): string {
    return DOMPurify.sanitize(rawHtml, {
        ADD_TAGS: ['button', 'input'],
        ADD_ATTR: [
            'data-img-filename', 'data-task-index', 'type', 'checked', 'class',
            'data-widget-type', 'data-query', 'data-wiki-target', 'data-embed-target',
            'data-embed-heading', 'data-embed-block', 'style', 'width', 'alt',
            'data-callout', 'data-callout-fold', 'dir',
            'align', 'data-tag'
        ]
    });
}

export interface ParseOptions {
    showProperties?: boolean;
    extractHeading?: string;
    extractBlock?: string;
}

/**
 * Markdown文字列をパースしてHTMLに変換するメイン関数
 */
export async function parseMarkdown(content: string, tabPath: string, options: ParseOptions = {}): Promise<string> {
    const { showProperties = false, extractHeading, extractBlock } = options;

    const processor = unified()
        .use(remarkParse)
        .use(remarkGfm)                    // テーブル等の構文拡張は必ずパース直後に行う
        .use(remarkFrontmatter, ['yaml'])
        .use(remarkEscapeUserHtml)         // ユーザ起因のタグを無害化(既存仕様維持)
        .use(remarkPropertiesCard, { showProperties: showProperties && !extractHeading && !extractBlock }) // 抽出時はプロパティ非表示
        .use(remarkExtractContent, { extractHeading, extractBlock }) // 指定があれば抽出
        .use(remarkHideBlockIds)           // ビューモード用に ^block-id を非表示化
        .use(remarkCallouts)               // Calloutのパース
        .use(remarkTags)                   // 本文中の #タグ のパース
        .use(remarkObsidianExtensions)
        .use(remarkBreaks)                 // Enter 1回を <br> に変換（拡張記法パース後に適用）
        .use(remarkHeadings)
        .use(remarkCodeBlocks)
        .use(remarkRehype, { allowDangerousHtml: true }) // 生成したHTMLノードを許可
        .use(rehypeRaw)                                  // HTML文字列をHASTに変換
        .use(rehypeTaskLists)                            // タスクリストのDOM構造最適化
        .use(rehypeStringify);

    const vfile = await processor.process(content);
    return String(vfile);

}