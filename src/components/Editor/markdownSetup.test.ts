// markdownSetup.ts（MarkdownパースとDOMPurifyサニタイズ統合パイプライン）の単体テスト
import { describe, it, expect, vi } from 'vitest';

vi.mock('@tauri-apps/api/event', () => ({
    listen: vi.fn(() => Promise.resolve(() => {})),
    emit: vi.fn(() => Promise.resolve())
}));

import { parseMarkdown, sanitizeHtml, removeFrontmatter } from './markdownSetup';

async function renderSafeHtml(markdown: string, options = {}) {
    const raw = await parseMarkdown(markdown, 'test.md', options);
    return sanitizeHtml(raw);
}

describe('markdownSetup パイプラインと DOMPurify サニタイズ', () => {
    it('Wikiリンクの data-wiki-target とクラスがサニタイズ後も保持される', async () => {
        const html = await renderSafeHtml('詳細は [[TargetPage|表示名]] を参照');
        expect(html).toContain('class="obsidian-wiki-link"');
        expect(html).toContain('data-wiki-target="TargetPage"');
        expect(html).toContain('>表示名</a>');
    });

    it('画像・ノート埋め込みの data-* 属性がサニタイズ後も保持される', async () => {
        const html = await renderSafeHtml('![[sample.png|300]]\n\n![[Memo#見出し]]\n\n![[Memo#^block1]]');
        expect(html).toContain('data-img-filename="sample.png"');
        expect(html).toContain('width="300"');
        expect(html).toContain('data-embed-target="Memo"');
        expect(html).toContain('data-embed-heading="見出し"');
        expect(html).toContain('data-embed-block="block1"');
    });

    it('Callout の data-callout / data-callout-fold がサニタイズ後も保持される', async () => {
        const html = await renderSafeHtml('> [!info]- 折りたたみタイトル\n> 本文です');
        expect(html).toContain('class="obsidian-callout is-collapsed"');
        expect(html).toContain('data-callout="info"');
        expect(html).toContain('data-callout-fold="-"');
        expect(html).toContain('折りたたみタイトル');
    });

    it('インラインタグの data-tag がサニタイズ後も保持される（コード内は無視）', async () => {
        const html = await renderSafeHtml('作業メモ #project/test\n\n`#ignored`');
        expect(html).toContain('class="obsidian-tag"');
        expect(html).toContain('data-tag="project/test"');
        expect(html).not.toContain('data-tag="ignored"');
    });

    it('検索ウィジェットのプレースホルダー属性がサニタイズ後も保持される', async () => {
        const html = await renderSafeHtml('```search\nWHERE #todo\nSORT file.mtime ASC\n```');
        expect(html).toContain('class="dashboard-widget"');
        expect(html).toContain('data-widget-type="search"');
        expect(html).toContain('data-query="#todo"');
        expect(html).toContain('data-sort-key="updated"');
        expect(html).toContain('data-sort-order="asc"');
    });

    it('タスクリストの checkbox が input タグとして残り、button（コピーボタン）も除去されない', async () => {
        const html = await renderSafeHtml('- [ ] 未完了タスク\n\n```ts\nconst x = 1;\n```');
        expect(html).toContain('<input type="checkbox"');
        expect(html).toContain('class="task-checkbox"');
        expect(html).toContain('class="code-copy-btn"');
    });

    it('フロントマターのプロパティ表示と removeFrontmatter が正しく動作する', async () => {
        const md = '---\ntags: [alpha, beta]\nstatus: active\n---\n本文';
        const html = await renderSafeHtml(md, { showProperties: true });
        expect(html).toContain('class="obsidian-properties-card"');
        expect(html).toContain('data-tag="alpha"');
        expect(html).toContain('data-tag="beta"');
        expect(removeFrontmatter(md)).toBe('本文');
    });

    it('ユーザー入力の生HTML・危険なイベントハンドラは無害化される', async () => {
        const html = await renderSafeHtml('<script>alert(1)</script><img src=x onerror="alert(2)">');
        const container = document.createElement('div');
        container.innerHTML = html;
        expect(container.querySelector('script')).toBeNull();
        expect(container.querySelector('img')).toBeNull();
        expect(html).not.toContain('<script>');
        expect(html).not.toContain('<img');

        // sanitizeHtml単体でもイベントハンドラ属性が除去されることを確認
        const sanitizedDirect = sanitizeHtml('<img src="x" onerror="alert(2)">');
        expect(sanitizedDirect).not.toContain('onerror');
    });
});
