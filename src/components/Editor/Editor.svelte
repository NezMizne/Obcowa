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
        }
    };


    // 同一タブに対する多重IPC呼び出しを防止するセット
    let fetchingModifiedTabs = new Set<string>();
    $: if (activeTab && activeTab.path && !isSpecialPath(activeTab.path) && activeTab.lastModified === 0 && !fetchingModifiedTabs.has(activeTab.id)) {
        fetchingModifiedTabs.add(activeTab.id);
        invoke('get_file_modified', { path: activeTab.path }).then((modified: any) => {
            // 💥 変更: 直接プロパティを書き換えず、イミュータブルに更新する
            openTabs.update(tabs => {
                return tabs.map(t => 
                    t.id === activeTab!.id ? { ...t, lastModified: modified as number } : t
                );
            });
            fetchingModifiedTabs.delete(activeTab!.id);
        }).catch(() => {});
            fetchingModifiedTabs.delete(activeTab!.id);
    }
   // 💥 連続保存による非同期のズレを防ぐためのロック用変数
   let savePromise: Promise<void> | null = null;

   // 💥 修正: 保存対象のタブを引数で受け取れるように変更（指定がなければ現在のアクティブタブ）
    async function saveCurrentTab(explicitTab?: any) {
        if (isDialogShowing) return; 
        
        // 💥 別の保存処理が実行中の場合は完了を待つ（レースコンディション防止）
        if (savePromise) {
            await savePromise;
        }

        savePromise = (async () => {
            // 非同期待ちの間にタブが切り替わっている可能性があるため、Storeから最新の情報を取得する
            const targetTab = explicitTab || $openTabs.find(t => t.id === $activeTabId);

            if (!targetTab) return;

            await saveTabWithConflictCheck(
                targetTab,
                saveDeps,
                (updater) => openTabs.update(tabs => tabs.map(t => t.id === targetTab.id ? updater(t) : t)),
                (showing) => { isDialogShowing = showing; }
            );
        })();

        await savePromise;
        savePromise = null;
    }

    async function handleTabClick(tabId: string) {
        clearTimeout(saveTimeout);
       // 💥 切り替え前のタブを確実に指定して保存
        if (activeTab) {
            await saveCurrentTab(activeTab);
        }
        const nextTab = $openTabs.find(t => t.id === tabId);

        scrollRatio = 0; // 別のタブを開いた時に前回のスクロール位置を引き継がないようリセットする

        switchTab(tabId);
    }

    async function handleTabClose(tabId: string) {
        if (isDialogShowing) return;
        
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
            if (!saved && tab.isConflict) return; // キャンセルされた場合は閉じない
        }
        closeTab(tabId);
    }

    async function toggleEditMode() {
        if (!activeTab) return;
        
        if (activeTab.isEditing && editArea) { 
            scrollRatio = calculateScrollRatio(editArea.scrollTop, editArea.scrollHeight); 
        } else if (!activeTab.isEditing && previewScrollContainer) { 
            scrollRatio = calculateScrollRatio(previewScrollContainer.scrollTop, previewScrollContainer.scrollHeight); 
        }

        if (activeTab.isEditing && activeTab.path) { await saveCurrentTab(); } 
        else if (!activeTab.isEditing && activeTab.path && !isSpecialPath(activeTab.path) && !activeTab.isDirty) {
            try {
                const latestContent: string = await invoke('read_file_content', { path: activeTab.path });
                activeTab.content = latestContent;
                
                // 💥 閲覧モードから編集モードに戻す/読み込む際にも最新の更新日時を取得する
                const modified = (await invoke('get_file_modified', { path: activeTab.path })) as number;
                activeTab.lastModified = modified;
            } catch(e) {}
        }

        // Storeのイミュータブル更新に修正
        openTabs.update(tabs => tabs.map(t => 
            t.id === activeTab!.id 
                ? { ...t, content: !t.isEditing ? activeTab!.content : t.content, isEditing: !t.isEditing } 
                : t
        ));

        await tick();

         // プレビュー側はイベントで処理するため、ここは編集エリア（textarea）のみにする
        if (activeTab.isEditing && editArea) {

            editArea.scrollTop = calculateScrollTopFromRatio(scrollRatio, editArea.scrollHeight);
        }
    }
    
    // プレビュー画面のHTML描画が終わった合図を受け取って実行される関数
    function handlePreviewRendered() {
        if (!activeTab?.isEditing && previewScrollContainer) {
            previewScrollContainer.scrollTop = calculateScrollTopFromRatio(scrollRatio, previewScrollContainer.scrollHeight);
        }
    }

function handleInput(event: Event) {
        const target = event.target as HTMLTextAreaElement;
        if (!activeTab) return;
        
        const newText = target.value;
        activeTab.content = newText;

        // 💥 キー入力があったら即座に保留(Conflict)を解除し、未保存(Dirty)にする
        if (activeTab.isConflict || !activeTab.isDirty) {
            activeTab.isConflict = false;
            activeTab.isDirty = true;

            // 💥 変更: Storeのイミュータブル更新に修正
            openTabs.update(tabs => tabs.map(t => 
                t.id === activeTab!.id ? { ...t, isDirty: true, isConflict: false } : t
            ));
        }

        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => { 
            // 1.5秒キー入力が止まったらStoreに内容を反映して自動保存

            // 💥 変更: Storeのイミュータブル更新に修正
            openTabs.update(tabs => tabs.map(t => 
                t.id === activeTab!.id ? { ...t, content: newText } : t
            ));
            const current = $openTabs.find(t => t.id === activeTab!.id);
            // 保留が解除されている場合のみ保存を実行
            if (!current?.isConflict) {
                saveCurrentTab(current); 
            }
        }, 1500);
    }

    // 💥 プレビュー(ビューモード)でのコンテンツ変更（タスク切り替え等）を受け取って保存する関数
    function handlePreviewContentChange(event: CustomEvent<{ path: string; content: string }>) {
        if (!activeTab) return;
        const { content } = event.detail;
        
        openTabs.update(tabs => {
            return tabs.map(t => {
                if (t.id === activeTab!.id) {
                    return { ...t, content, isDirty: true, isConflict: false };
                }
                return t;
            });
        });

        // Editor.svelte 既存の競合チェック付き安全保存を実行
        saveCurrentTab();
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
                        <textarea bind:this={editArea} class="flex-1 w-full bg-transparent resize-none focus:outline-none p-6 overflow-y-auto" style="font-family: var(--editor-font, {$editorFont}); font-size: var(--editor-font-size, 14px); line-height: var(--editor-line-height, 1.6); color: var(--text-color);" value={activeTab.content} on:input={handleInput}></textarea>
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