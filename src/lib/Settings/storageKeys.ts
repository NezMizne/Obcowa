// 責務: アプリ全体で使用する localStorage のキー定数を一元管理する

export const STORAGE_KEYS = {
    ACTIVE_THEME: 'activeTheme',
    CUSTOM_THEMES: 'customThemes',
    ACTIVE_STYLE: 'activeStyle',
    CUSTOM_STYLE_SLOTS: 'customStyleSlots',
    REGISTERED_TAGS: 'registeredTags',
    SHOW_LAUNCHER_ON_STARTUP: 'showLauncherOnStartup',
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];
