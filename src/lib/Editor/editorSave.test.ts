// editorSave関数の単体テスト
import { describe, it, expect, vi } from 'vitest';
import { saveTabWithConflictCheck, type SaveDependencies, type BaseTabData } from './editorSave';

describe('editorSave', () => {
    it('isDirtyがfalseの場合は保存処理を行わない', async () => {
        const mockSave = vi.fn();
        const deps: SaveDependencies = {
            saveFileContent: mockSave,
            getModified: vi.fn(),
            readFileContent: vi.fn(),
            askConflictResolution: vi.fn(),
        };

        const tab: BaseTabData = { id: '1', path: '/test.md', content: 'hello', isDirty: false };
        const result = await saveTabWithConflictCheck(tab, deps, vi.fn());

        expect(result).toBe(true);
        expect(mockSave).not.toHaveBeenCalled();
    });

    it('正常保存時にisDirtyがクリアされ更新日時がセットされる', async () => {
        const deps: SaveDependencies = {
            saveFileContent: vi.fn().mockResolvedValue(1000),
            getModified: vi.fn(),
            readFileContent: vi.fn(),
            askConflictResolution: vi.fn(),
        };

        const tab: BaseTabData = { id: '1', path: '/test.md', content: 'hello', isDirty: true, lastModified: 500 };
        let updatedTab = { ...tab };

        const result = await saveTabWithConflictCheck(tab, deps, (updater) => {
            updatedTab = updater(updatedTab);
        });

        expect(result).toBe(true);
        expect(updatedTab.isDirty).toBe(false);
        expect(updatedTab.lastModified).toBe(1000);
    });

    it('CONFLICT時にユーザーが上書きを選択した場合、force=trueで再保存する', async () => {
        const saveFileContentMock = vi.fn()
            .mockRejectedValueOnce('CONFLICT')
            .mockResolvedValueOnce(2000);

        const deps: SaveDependencies = {
            saveFileContent: saveFileContentMock,
            getModified: vi.fn(),
            readFileContent: vi.fn().mockResolvedValue('remote'),
            askConflictResolution: vi.fn().mockResolvedValue('overwrite'),
        };

        const tab: BaseTabData = { id: '1', path: '/test.md', content: 'hello', isDirty: true };
        let updatedTab = { ...tab };

        const result = await saveTabWithConflictCheck(tab, deps, (updater) => {
            updatedTab = updater(updatedTab);
        });

        expect(result).toBe(true);
        expect(saveFileContentMock).toHaveBeenNthCalledWith(1, '/test.md', 'hello', 0, false);
        expect(saveFileContentMock).toHaveBeenNthCalledWith(2, '/test.md', 'hello', 0, true);
        expect(updatedTab.isDirty).toBe(false);
        expect(updatedTab.lastModified).toBe(2000);
    });

    it('保存完了までの間にStore上のcontentが追加入力で変わっていればisDirtyをfalseにしない', async () => {
        const tab: BaseTabData = { id: '1', path: '/test.md', content: '平仮名', isDirty: true, lastModified: 500 };
        let updatedTab = { ...tab };

        const deps: SaveDependencies = {
            saveFileContent: vi.fn().mockImplementation(async () => {
                updatedTab = { ...updatedTab, content: '漢字', isDirty: true };
                return 1000;
            }),
            getModified: vi.fn(),
            readFileContent: vi.fn(),
            askConflictResolution: vi.fn(),
        };

        const result = await saveTabWithConflictCheck(tab, deps, (updater) => {
            updatedTab = updater(updatedTab);
        });

        expect(result).toBe(true);
        expect(updatedTab.isDirty).toBe(true);
        expect(updatedTab.lastModified).toBe(1000);
    });

    it('CONFLICT後の強制上書きでエラーが起きた場合、onErrorを呼んでfalseを返す', async () => {
        const saveFileContentMock = vi.fn()
            .mockRejectedValueOnce('CONFLICT')
            .mockRejectedValueOnce('WRITE_FAILED');
        const onErrorMock = vi.fn();

        const deps: SaveDependencies = {
            saveFileContent: saveFileContentMock,
            getModified: vi.fn(),
            readFileContent: vi.fn().mockResolvedValue('remote'),
            askConflictResolution: vi.fn().mockResolvedValue('overwrite'),
            onError: onErrorMock,
        };

        const tab: BaseTabData = { id: '1', path: '/test.md', content: 'hello', isDirty: true };
        let updatedTab = { ...tab };

        const result = await saveTabWithConflictCheck(tab, deps, (updater) => {
            updatedTab = updater(updatedTab);
        });

        expect(result).toBe(false);
        expect(onErrorMock).toHaveBeenCalledTimes(1);
    });

    it('CONFLICT時にreloadを選択した場合、外部データと最新lastModifiedで更新する', async () => {
        const deps: SaveDependencies = {
            saveFileContent: vi.fn().mockRejectedValueOnce('CONFLICT'),
            getModified: vi.fn().mockResolvedValue(3000),
            readFileContent: vi.fn().mockResolvedValue('latest remote'),
            askConflictResolution: vi.fn().mockResolvedValue('reload'),
        };

        const tab: BaseTabData = { id: '1', path: '/test.md', content: 'local', isDirty: true, lastModified: 100 };
        let updatedTab = { ...tab };

        const result = await saveTabWithConflictCheck(tab, deps, (updater) => {
            updatedTab = updater(updatedTab);
        });

        expect(result).toBe(false);
        expect(updatedTab.content).toBe('latest remote');
        expect(updatedTab.isDirty).toBe(false);
        expect(updatedTab.lastModified).toBe(3000);
        expect(updatedTab.isConflict).toBe(false);
    });

    it('CONFLICT時にcancelを選択した場合、isConflictがtrueになる', async () => {
        const deps: SaveDependencies = {
            saveFileContent: vi.fn().mockRejectedValueOnce('CONFLICT'),
            getModified: vi.fn(),
            readFileContent: vi.fn().mockResolvedValue('remote'),
            askConflictResolution: vi.fn().mockResolvedValue('cancel'),
        };

        const tab: BaseTabData = { id: '1', path: '/test.md', content: 'local', isDirty: true, lastModified: 100 };
        let updatedTab = { ...tab };

        const result = await saveTabWithConflictCheck(tab, deps, (updater) => {
            updatedTab = updater(updatedTab);
        });

        expect(result).toBe(false);
        expect(updatedTab.isConflict).toBe(true);
    });
});