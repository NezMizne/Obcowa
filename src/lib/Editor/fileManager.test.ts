// fileManagerの単体テスト
import { describe, it, expect, vi, beforeEach } from 'vitest';

const invokeMock = vi.fn();

vi.mock('@tauri-apps/api/core', () => ({
    invoke: invokeMock,
}));

vi.mock('../stores', () => ({
    openTabs: {
        update: vi.fn(),
    },
}));

describe('fileManager', () => {
    beforeEach(() => {
        invokeMock.mockReset();
    });

    it('一度エラー（CONFLICT等）が発生してもキューが壊れず、後続の保存が実行される', async () => {
        const { requestSaveFile } = await import('./fileManager');

        invokeMock
            .mockRejectedValueOnce('CONFLICT')
            .mockResolvedValueOnce(2000);

        await expect(requestSaveFile('/test.md', 'local', 1000, false)).rejects.toBe('CONFLICT');

        const nextModified = await requestSaveFile('/test.md', 'local', 1000, true);
        expect(nextModified).toBe(2000);
        expect(invokeMock).toHaveBeenCalledTimes(2);
        expect(invokeMock).toHaveBeenNthCalledWith(2, 'save_file_content', {
            path: '/test.md',
            content: 'local',
            lastModified: 1000,
            force: true,
        });
    });
});
