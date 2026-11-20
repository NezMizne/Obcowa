
import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { initTheme, applyThemeToRoot, activeTheme, defaultThemes } from './theme';
import { STORAGE_KEYS } from './storageKeys';

describe('theme.ts のテスト', () => {
  beforeEach(() => {
    // 毎回のテスト前にデータをまっさらにリセットする
    localStorage.clear();
    activeTheme.set(defaultThemes[0]);
  });

  it('デフォルトで3つのテーマが用意されており、初期状態はダークテーマであること', () => {
    expect(defaultThemes.length).toBe(3);
    expect(get(activeTheme).id).toBe('dark');
  });

  it('過去の壊れたデータ（欠損）があっても、新項目がデフォルト値で補完されて復元されること', () => {
    // わざと menuBg や selectionBg が存在しない古い形式のデータを保存
    const oldThemeData = { id: 'old', name: '古いテーマ', bgColor: '#000000' };
    localStorage.setItem(STORAGE_KEYS.ACTIVE_THEME, JSON.stringify(oldThemeData));
    
    // 復元処理を実行
    initTheme();
    
    const current = get(activeTheme);
    expect(current.bgColor).toBe('#000000'); // 既存の値は守られる
    expect(current.menuBg).toBe('#111827');  // 欠損していた値が補完されているか
    expect(current.selectionBg).toBe('#4b5563'); // 欠損していた値が補完されているか
  });

  it('テーマ適用関数を呼ぶと、CSS変数がセットされること', () => {
    const theme = defaultThemes[0];
    applyThemeToRoot(theme);
    
    // 画面（仮想ブラウザ）のルート要素に、本当に色が書き込まれたか確認
    const root = document.documentElement;
    expect(root.style.getPropertyValue('--bg-color')).toBe(theme.bgColor);
    expect(root.style.getPropertyValue('--selection-bg')).toBe(theme.selectionBg);
  });
});