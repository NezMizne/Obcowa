<!-- エディタ画面を統括する親部品 -->

<!-- --- START OF src/components/Editor.svelte --- -->
<script lang="ts">
    import { openTabs, activeTabId, currentWorkspaceIndex, openFileInNewTab, switchTab, closeTab, editorFont } from '$lib/stores';
    import { invoke } from '@tauri-apps/api/core';
    import { confirm as tauriConfirm } from '@tauri-apps/plugin-dialog'; 
    import { tick } from 'svelte';
    import { Inbox } from 'lucide-svelte';
    
    import EditorHeader from './EditorHeader.svelte';
    import TabBar from './TabBar.svelte';
    import EditorPreview from './EditorPreview.svelte';
    import EditorSearch from './EditorSearch.svelte';
    import { saveTabWithConflictCheck, type SaveDependencies } from '../../lib/editor/editorSave';
    import { calculateScrollRatio, calculateScrollTopFromRatio } from '../../lib/editor/scrollSync';
    import TaskList from '../../features/Task/TaskList.svelte';
    import { isSpecialPath } from '../../lib/utils/pathUtils';
    import ConflictDialog from '../Modals/ConflictDialog.svelte';
    import { requestSaveFile } from '../../lib/editor/fileManager';

    import RightSidebar from '../RightSidebar/RightSidebar.svelte';
    import { PanelRightOpen } from 'lucide-svelte';

    let isRightSidebarOpen = false;
    let previewComponent: any; // EditorPreviewコンポーネントの参照用

    $: activeTab = $openTabs.find(t => t.id === $activeTabId);

    // --- タブと保存の管理 ---
    let saveTimeout: ReturnType<typeof setTimeout>;
    let isDialogShowing = false; //  ダイアログの連続表示を防止するためのフラグ
    let previewScrollContainer: HTMLDivElement | undefined;
    let editArea: HTMLTextAreaElement;
    let scrollRatio = 0;

       // 💥 競合ダイアログ用の状態管理
   let conflictDialogOpen = false;
   let conflictFilePath = "";
   let conflictLocalContent = "";
   let conflictRemoteContent = "";
   let conflictResolve: ((res: 'overwrite' | 'reload' | 'cancel') => void) | null = null;
 
   // ダイアログを開き、ユーザーの選択を待つPromiseを返す
   const askConflictResolution = (path: string, localContent: string, remoteContent: string): Promise<'overwrite' | 'reload' | 'cancel'> => {
       return new Promise((resolve) => {
           conflictFilePath = path;
           conflictLocalContent = localContent;
           conflictRemoteContent = remoteContent;
           conflictDialogOpen = true;
           conflictResolve = (res) => {
               conflictDialogOpen = false;
               resolve(res);
           };
       });
   };

    const saveDeps: SaveDependencies = {
        // 直接 invoke せず、キュー管理された requestSaveFile に任せる
        saveFileContent: (path, content, lastModified, force) => requestSaveFile(path, content, lastModified, force),
        getModified: (path) => invoke('get_file_modified', { path }),
        readFileContent: (path) => invoke('read_file_content', { path }),
        askConflictResolution,
        saveDashboard: async (workspaceId, content) => {
            await invoke('save_dashboard', { workspaceId, content });
        },
        onError: (message) => {
            alert(message);
        }
    };

    let isComposing = false;
    let lastObservedTabId: string | null = null;
    $: if ($activeTabId !== lastObservedTabId) {
        isComposing = false;
        lastObservedTabId = $activeTabId;
    }

    // 編集テキストエリアの値をStoreと同期（IME変換中や内容が既に一致している入力中はDOMを書き換えない）
    $: if (editArea && activeTab?.isEditing && !isComposing && editArea.value !== activeTab.content) {
        editArea.value = activeTab.content ?? '';
    }

    // 同一タブに対する多重IPC呼び出しを防止するセット
    let fetchingModifiedTabs = new Set<string>();
    $: if (activeTab && activeTab.path && !isSpecialPath(activeTab.path) && activeTab.lastModified === 0 && !fetchingModifiedTabs.has(activeTab.id)) {
        const targetId = activeTab.id;
        const targetPath = activeTab.path;
        fetchingModifiedTabs.add(targetId);
        invoke<number>('get_file_modified', { path: targetPath })
            .then((modified) => {
                // イミュータブルに更新する（非同期完了時に対象タブ・パスが一致する場合のみ反映）
                openTabs.update(tabs => {
                    return tabs.map(t =>
                        t.id === targetId && t.path === targetPath ? { ...t, lastModified: modified } : t
                    );
                });
            })
            .catch((err) => {
                console.error(`Failed to fetch file modified time [${targetPath}]:`, err);
            })
            .finally(() => {
                fetchingModifiedTabs.delete(targetId);
            });
    }

    // 連続保存による非同期のズレを防ぐためのロック用変数
    let savePromise: Promise<void> | null = null;

    // 編集エリア上の未反映テキスト（IME確定直前など）を保存前にStoreへ反映する
    function flushEditorContentToStore(tabId: string) {
        if (editArea && activeTab?.id === tabId && activeTab.isEditing && editArea.value !== activeTab.content) {
            const latestValue = editArea.value;
            openTabs.update(tabs => tabs.map(t =>
                t.id === tabId ? { ...t, content: latestValue, isDirty: true, isConflict: false } : t
            ));
        }
    }

    // 保存対象のタブIDを受け取り、ロック待機後に最新のStore状態から保存を実行する
    async function saveCurrentTab(targetTabId?: string) {
        if (isDialogShowing) return;

        // 別の保存処理が実行中の場合は完了を待つ（レースコンディション防止）
        if (savePromise) {
            await savePromise;
        }

        const currentPromise = (async () => {
            // 非同期待ちの間にStoreが更新・タブが切り替わっている可能性があるため、Storeから最新の情報を取得する
            const idToSave = targetTabId ?? $activeTabId;
            if (!idToSave) return;
            const targetTab = $openTabs.find(t => t.id === idToSave);

            if (!targetTab) return;

            await saveTabWithConflictCheck(
                targetTab,
                saveDeps,
                (updater) => openTabs.update(tabs => tabs.map(t => t.id === idToSave ? updater(t) : t)),
                (showing) => { isDialogShowing = showing; }
            );
        })();

        savePromise = currentPromise;
        try {
            await currentPromise;
        } finally {
            if (savePromise === currentPromise) {
                savePromise = null;
            }
        }
    }

    async function handleTabClick(tabId: string) {
        clearTimeout(saveTimeout);
        isComposing = false;
        // 切り替え前のタブを確実に指定して保存
        if (activeTab) {
            flushEditorContentToStore(activeTab.id);
            await saveCurrentTab(activeTab.id);
        }

        scrollRatio = 0; // 別のタブを開いた時に前回のスクロール位置を引き継がないようリセットする

        switchTab(tabId);
    }

    async function handleTabClose(tabId: string) {
        if (isDialogShowing) return;
        clearTimeout(saveTimeout);
        isComposing = false;

        if (activeTab?.id === tabId) {
            flushEditorContentToStore(tabId);
        }

        // 他の保存が走っていれば待つ
        if (savePromise) await savePromise;

        const tab = $openTabs.find(t => t.id === tabId);

        if (tab) {
            const saved = await saveTabWithConflictCheck(
                tab,
                saveDeps,
                (updater) => openTabs.update(tabs => tabs.map(t => t.id === tab.id ? updater(t) : t)),
                (showing) => { isDialogShowing = showing; }
            );
            const latestTab = $openTabs.find(t => t.id === tabId);
            if (!saved && latestTab?.isConflict) return; // キャンセル（保留）された場合は閉じない
        }
        closeTab(tabId);
    }

    async function toggleEditMode() {
        if (!activeTab) return;
        const targetId = activeTab.id;
        const wasEditing = activeTab.isEditing;
        isComposing = false;

        if (wasEditing && editArea) {
            scrollRatio = calculateScrollRatio(editArea.scrollTop, editArea.scrollHeight);
        } else if (!wasEditing && previewScrollContainer) {
            scrollRatio = calculateScrollRatio(previewScrollContainer.scrollTop, previewScrollContainer.scrollHeight);
        }

        let reloadedContent: string | null = null;
        let reloadedModified: number | null = null;

        if (wasEditing && activeTab.path) {
            clearTimeout(saveTimeout);
            flushEditorContentToStore(targetId);
            await saveCurrentTab(targetId);
        } else if (!wasEditing && activeTab.path && !isSpecialPath(activeTab.path) && !activeTab.isDirty) {
            try {
                reloadedContent = await invoke<string>('read_file_content', { path: activeTab.path });
                // 閲覧モードから編集モードに戻す/読み込む際にも最新の更新日時を取得する
                reloadedModified = await invoke<number>('get_file_modified', { path: activeTab.path });
            } catch (e) {
                console.error('Failed to reload file on entering edit mode:', e);
            }
        }

        // Storeのイミュータブル更新
        openTabs.update(tabs => tabs.map(t => {
            if (t.id !== targetId) return t;
            return {
                ...t,
                content: reloadedContent !== null ? reloadedContent : t.content,
                lastModified: reloadedModified !== null ? reloadedModified : t.lastModified,
                isEditing: !wasEditing
            };
        }));

        await tick();

        // プレビュー側はイベントで処理するため、ここは編集エリア（textarea）のみにする
        if (!wasEditing && editArea) {
            editArea.scrollTop = calculateScrollTopFromRatio(scrollRatio, editArea.scrollHeight);
        }
    }
    
    // プレビュー画面のHTML描画が終わった合図を受け取って実行される関数
    function handlePreviewRendered() {
        if (!activeTab?.isEditing && previewScrollContainer) {
            previewScrollContainer.scrollTop = calculateScrollTopFromRatio(scrollRatio, previewScrollContainer.scrollHeight);
        }
    }

    function scheduleAutoSave(tabId: string) {
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
            if (isComposing) return;
            const current = $openTabs.find(t => t.id === tabId);
            // 保留が解除されている場合のみ保存を実行
            if (current && !current.isConflict) {
                saveCurrentTab(tabId);
            }
        }, 1500);
    }

    function handleCompositionStart() {
        isComposing = true;
        clearTimeout(saveTimeout);
    }

    function handleCompositionEnd(event: CompositionEvent) {
        isComposing = false;
        const target = event.target as HTMLTextAreaElement;
        if (!activeTab) return;

        const tabId = activeTab.id;
        const newText = target.value;

        openTabs.update(tabs => tabs.map(t =>
            t.id === tabId
                ? { ...t, content: newText, isDirty: true, isConflict: false }
                : t
        ));

        scheduleAutoSave(tabId);
    }

    function handleInput(event: Event) {
        const target = event.target as HTMLTextAreaElement;
        if (!activeTab) return;

        // IME変換中の未確定入力では自動保存・Store更新を走らせず、compositionend時に確定内容を反映する
        const inputEv = event as InputEvent;
        if (isComposing || inputEv.isComposing) {
            clearTimeout(saveTimeout);
            return;
        }

        const tabId = activeTab.id;
        const newText = target.value;

        openTabs.update(tabs => tabs.map(t =>
            t.id === tabId
                ? { ...t, content: newText, isDirty: true, isConflict: false }
                : t
        ));

        scheduleAutoSave(tabId);
    }

    // 💥 プレビュー(ビューモード)でのコンテンツ変更（タスク切り替え等）を受け取って保存する関数
    function handlePreviewContentChange(event: CustomEvent<{ path: string; content: string }>) {
        if (!activeTab) return;
        const { content } = event.detail;
        const targetId = activeTab.id;
        
        openTabs.update(tabs => {
            return tabs.map(t => {
                if (t.id === targetId) {
                    return { ...t, content, isDirty: true, isConflict: false };
                }
                return t;
            });
        });

        // Editor.svelte 既存の競合チェック付き安全保存を実行
        saveCurrentTab(targetId);
    }


    // アウトライン見出しクリック時のジャンプ処理
    function handleOutlineJump(event: CustomEvent<{ lineIndex: number, headingIndex: number }>) {
        const { lineIndex, headingIndex } = event.detail;
        
        if (activeTab?.isEditing && editArea) {
            // テキストエリアの場合は、行番号から文字数を計算してフォーカスを合わせる
            const text = activeTab.content || '';
            let pos = 0;
            const lines = text.split('\n');
            for (let i = 0; i < lineIndex && i < lines.length; i++) {
                pos += lines[i].length + 1; // 1は改行文字分
            }
            editArea.focus();
            editArea.setSelectionRange(pos, pos);
        } else if (!activeTab?.isEditing && previewComponent) {
            // プレビューの場合はDOM操作で直接スクロールする
            previewComponent.scrollToHeading(headingIndex);
        }
    }

</script>
    
<div class="h-full flex flex-row transition-colors duration-200 w-full overflow-hidden" style="background-color: var(--bg-color); color: var(--text-color);">
    
    <!-- エディタメイン領域 (ここを flex-1 flex-col min-w-0 でラップする) -->
    <div class="flex-1 flex flex-col min-w-0 relative">
        <TabBar {handleTabClick} {handleTabClose} />

        {#if activeTab}
            <div class="flex-1 relative flex flex-col overflow-hidden" style="background-color: var(--bg-color);">
                
                {#if activeTab.path === '__SEARCH__'}
                    <EditorSearch />
                {:else if activeTab.path === '__TASK__'}
                <TaskList workspaceIndex={$currentWorkspaceIndex} />
                {:else}
                    
                    <EditorHeader {activeTab} {toggleEditMode} />

                    {#if activeTab.isEditing}
                        <textarea
                            bind:this={editArea}
                            class="flex-1 w-full bg-transparent resize-none focus:outline-none p-6 overflow-y-auto"
                            style="font-family: var(--editor-font, {$editorFont}); font-size: var(--editor-font-size, 14px); line-height: var(--editor-line-height, 1.6); color: var(--text-color);"
                            on:compositionstart={handleCompositionStart}
                            on:compositionend={handleCompositionEnd}
                            on:input={handleInput}
                        ></textarea>
                    {:else}
                        <!-- 🔽 bind:this={previewComponent} を追加 -->
                        <EditorPreview 
                            bind:this={previewComponent}
                            {activeTab} 
                            bind:scrollContainer={previewScrollContainer} 
                            on:renderComplete={handlePreviewRendered} 
                            on:contentChange={handlePreviewContentChange}
                        />
                    {/if}
                {/if}
            </div>
            
            <!-- 🔽 サイドバー展開ボタン (閉じている時のみ、画面右上に浮かせる) -->
            {#if !isRightSidebarOpen && activeTab.path !== '__TASK__'}
                <button 
                    on:click={() => isRightSidebarOpen = true}
                    class="absolute top-2 right-2 p-1.5 rounded opacity-50 hover:opacity-100 z-10 transition-all"
                    style="background-color: var(--menu-bg); "
                    title="右サイドバーを開く"
                >
                    <PanelRightOpen size={16} />
                </button>
            {/if}

        {:else}
            <!-- 既存の空状態 -->
            <div class="flex-1 flex flex-col items-center justify-center opacity-60" style="background-color: var(--bg-color);">
                <Inbox size={48} class="mb-4" />
                <div class="text-sm">ファイルを選択するか、＋ボタンで新規作成してください</div>
            </div>
        {/if}
    </div>

    <!-- 🔽 右サイドバー領域 (開いている時のみ描画) -->
    {#if isRightSidebarOpen && activeTab && activeTab.path !== '__TASK__'}
        <RightSidebar 
            {activeTab} 
            onClose={() => isRightSidebarOpen = false}
            on:jump={handleOutlineJump}
        />
    {/if}

</div>

 <ConflictDialog 
     isOpen={conflictDialogOpen} 
     filePath={conflictFilePath} 
     localContent={conflictLocalContent}
     remoteContent={conflictRemoteContent}
     onResolve={conflictResolve} 
 />
<!-- --- END OF src/components/Editor.svelte --- -->