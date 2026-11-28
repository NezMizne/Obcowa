// 責務: ThemeSettings.svelte コンポーネントの単体テスト
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import ThemeSettings from './ThemeSettings.svelte';
import { defaultThemes } from '../../lib/settings/theme';

describe('ThemeSettings.svelte のテスト', () => {
  it('エラーなく設定画面が描画されること', () => {
    // モーダルを開いた時に渡される一時変数のダミーを作成
    const mockTempTheme = { ...defaultThemes[0] };
    
    // コンポーネントを仮想の画面に描画（マウント）してみる
    const { getByText } = render(ThemeSettings, {
      props: { tempTheme: mockTempTheme }
    });
    
    // 「テーマの適用」や「現在の状態をカスタムテーマに保存」という見出しが正常に出力されているか
    expect(getByText('テーマの適用')).toBeTruthy();
    expect(getByText('現在の状態をカスタムテーマに保存')).toBeTruthy();
  });
});
