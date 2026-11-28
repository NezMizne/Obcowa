// 責務: imageViewer.ts（DOM上の画像プレースホルダー検出・読込・キャッシュ）の単体テスト
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { loadImagesInDom } from './imageViewer';

const invokeMock = vi.mocked(invoke);

describe('ImageViewer Logic (loadImagesInDom)', () => {
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;

    beforeEach(() => {
        invokeMock.mockReset();
        let urlCounter = 0;
        URL.createObjectURL = vi.fn(() => `blob:mock-url-${++urlCounter}`);
        URL.revokeObjectURL = vi.fn();
    });

    afterEach(() => {
        URL.createObjectURL = originalCreateObjectURL;
        URL.revokeObjectURL = originalRevokeObjectURL;
    });

    it('imageFoldersが指定されている場合、設定フォルダを優先検索して画像を読み込む', async () => {
        invokeMock.mockImplementation(async (cmd: string, args?: unknown) => {
            const payload = (args ?? {}) as Record<string, unknown>;
            if (cmd === 'find_image_file' && payload.dirPath === 'D:/Assets') {
                return 'D:/Assets/preferred.png';
            }
            if (cmd === 'read_image_bytes') {
                return [137, 80, 78, 71];
            }
            return null;
        });

        const container = document.createElement('div');
        container.innerHTML = '<img data-img-filename="preferred.png" />';

        await loadImagesInDom(container, 'C:/docs/note.md', ['D:/Assets']);

        const img = container.querySelector('img')!;
        expect(img.getAttribute('src')).toBe('blob:mock-url-1');
        expect(img.hasAttribute('data-img-filename')).toBe(false);
        expect(invokeMock).toHaveBeenCalledWith('find_image_file', {
            dirPath: 'D:/Assets',
            fileName: 'preferred.png'
        });
        expect(invokeMock).toHaveBeenCalledWith('read_image_bytes', {
            path: 'D:/Assets/preferred.png'
        });
    });

    it('設定フォルダにない場合、アクティブタブの親ディレクトリへフォールバック検索する', async () => {
        invokeMock.mockImplementation(async (cmd: string, args?: unknown) => {
            const payload = (args ?? {}) as Record<string, unknown>;
            if (cmd === 'find_image_file' && payload.dirPath === 'C:/docs') {
                return 'C:/docs/fallback.png';
            }
            if (cmd === 'read_image_bytes') {
                return [1, 2, 3];
            }
            return null;
        });

        const container = document.createElement('div');
        container.innerHTML = '<img data-img-filename="fallback.png" />';

        await loadImagesInDom(container, 'C:\\docs\\note.md', ['D:/EmptyAssets']);

        const img = container.querySelector('img')!;
        expect(img.getAttribute('src')).toBe('blob:mock-url-1');
        expect(invokeMock).toHaveBeenNthCalledWith(1, 'find_image_file', {
            dirPath: 'D:/EmptyAssets',
            fileName: 'fallback.png'
        });
        expect(invokeMock).toHaveBeenNthCalledWith(2, 'find_image_file', {
            dirPath: 'C:/docs',
            fileName: 'fallback.png'
        });
    });

    it('画像が見つからない場合はaltにエラーメッセージを設定し、data-img-filename属性を削除する', async () => {
        invokeMock.mockResolvedValue(null);

        const container = document.createElement('div');
        container.innerHTML = '<img data-img-filename="missing.png" />';

        await loadImagesInDom(container, 'C:/docs/note.md', []);

        const img = container.querySelector('img')!;
        expect(img.getAttribute('alt')).toBe('❌ 読込失敗: missing.png');
        expect(img.hasAttribute('data-img-filename')).toBe(false);
        expect(img.getAttribute('src')).toBeNull();
    });

    it('一度読み込んだ画像はBlobキャッシュが再利用され、2回目はinvokeが呼ばれない', async () => {
        invokeMock.mockImplementation(async (cmd: string) => {
            if (cmd === 'find_image_file') return 'C:/docs/cached.png';
            if (cmd === 'read_image_bytes') return [9, 8, 7];
            return null;
        });

        const container1 = document.createElement('div');
        container1.innerHTML = '<img data-img-filename="cached.png" />';
        await loadImagesInDom(container1, 'C:/docs/note.md', []);

        expect(invokeMock).toHaveBeenCalledTimes(2);

        invokeMock.mockClear();
        const container2 = document.createElement('div');
        container2.innerHTML = '<img data-img-filename="cached.png" />';
        await loadImagesInDom(container2, 'C:/docs/note.md', []);

        const img2 = container2.querySelector('img')!;
        expect(img2.getAttribute('src')).toBe('blob:mock-url-1');
        expect(img2.hasAttribute('data-img-filename')).toBe(false);
        expect(invokeMock).not.toHaveBeenCalled();
    });
});