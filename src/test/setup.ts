// 責務: Vitest全テスト共通のセットアップ（Tauri IPC/Event APIのデフォルトモック定義）
import { vi } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({
    invoke: vi.fn(() => Promise.resolve(undefined)),
}));

vi.mock('@tauri-apps/api/event', () => ({
    emit: vi.fn(() => Promise.resolve()),
    listen: vi.fn(() => Promise.resolve(() => {})),
}));
