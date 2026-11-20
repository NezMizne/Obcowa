// エディタ・見出しスタイル設定のストアとCSS変数生成・適用ロジック
import { writable } from 'svelte/store';
import { editorFont } from '../../lib/stores'; // 既存のストアと同期させるため
import { STORAGE_KEYS } from '../../lib/settings/storageKeys';

export interface HeadingStyle {
    fontSize: number; // rem単位
    borderBottom: boolean;
    italic: boolean;
    bold: boolean;
}

export interface StyleSlot {
    id: string;
    name: string;
    editorFont: string;
    editorFontSize: number; // px単位
    lineHeight: number;     // 倍率
    h1: HeadingStyle;
    h2: HeadingStyle;
    h3: HeadingStyle;
    h4: HeadingStyle;
    h5: HeadingStyle;
    h6: HeadingStyle;
}

// 初期値を生成するヘルパー関数
function createHeading(fontSize: number, borderBottom: boolean, bold: boolean = true): HeadingStyle {
    return { fontSize, borderBottom, italic: false, bold };
}

export const defaultStyle: StyleSlot = {
    id: 'default',
    name: 'デフォルトスタイル',
    editorFont: 'sans-serif',
    editorFontSize: 14,
    lineHeight: 1.6,
    h1: createHeading(2.25, true),
    h2: createHeading(1.875, true),
    h3: createHeading(1.5, false),
    h4: createHeading(1.25, false),
    h5: createHeading(1.125, false),
    h6: createHeading(1.0, false),
};

export const activeStyleSlot = writable<StyleSlot>(defaultStyle);
export const customStyleSlots = writable<StyleSlot[]>([
    { ...defaultStyle, id: 'slot1', name: 'スロット１' },
    { ...defaultStyle, id: 'slot2', name: 'スロット２' },
    { ...defaultStyle, id: 'slot3', name: 'スロット３' }
]);

// 💥 計算ロジック（純粋関数）：設定データをCSS変数の辞書に変換する
export function generateStyleCssVariables(style: StyleSlot): Record<string, string> {
    const vars: Record<string, string> = {};
    
    vars['--editor-font'] = style.editorFont;
    vars['--editor-font-size'] = `${style.editorFontSize}px`;
    vars['--editor-line-height'] = `${style.lineHeight}`;

    const headings = [
        { key: 'h1', data: style.h1 }, { key: 'h2', data: style.h2 },
        { key: 'h3', data: style.h3 }, { key: 'h4', data: style.h4 },
        { key: 'h5', data: style.h5 }, { key: 'h6', data: style.h6 },
    ];

    headings.forEach(({ key, data }) => {
        vars[`--${key}-size`] = `${data.fontSize}rem`;
        // 罫線はテーマの文字色（--text-color）を30%混ぜて薄い色を作る
        vars[`--${key}-border`] = data.borderBottom ? `1px solid color-mix(in srgb, var(--text-color) 30%, transparent)` : 'none';
        vars[`--${key}-style`] = data.italic ? 'italic' : 'normal';
        vars[`--${key}-weight`] = data.bold ? 'bold' : 'normal';
    });

    return vars;
}

// 💥 UI・DOM操作：生成したCSS変数をHTMLのルートに適用する
export function applyStyleToRoot(style: StyleSlot) {
    if (typeof document === 'undefined') return;
    
    const root = document.documentElement;
    const cssVars = generateStyleCssVariables(style);
    
    Object.entries(cssVars).forEach(([key, value]) => {
        root.style.setProperty(key, value);
    });

    // 既存のエディタフォント機能も壊さないように同時にストアを更新
    editorFont.set(style.editorFont);
}

// アプリ起動時の読み込み処理
export function initStyles() {
    if (typeof window === 'undefined') return;

    try {
        const savedActive = localStorage.getItem(STORAGE_KEYS.ACTIVE_STYLE);
        if (savedActive) {
            const parsed = JSON.parse(savedActive);
            activeStyleSlot.set(parsed);
            applyStyleToRoot(parsed);
        } else {
            applyStyleToRoot(defaultStyle);
        }

        const savedSlots = localStorage.getItem(STORAGE_KEYS.CUSTOM_STYLE_SLOTS);
        if (savedSlots) {
            customStyleSlots.set(JSON.parse(savedSlots));
        }
    } catch (e) {
        console.error("スタイル設定の復元に失敗しました", e);
    }
}