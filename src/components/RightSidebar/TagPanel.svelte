<!-- 責務: ワークスペース内のタグを階層ツリー化して表示し、検索と連動する -->
<!-- --- START OF src/components/RightSidebar/TagPanel.svelte --- -->
<script lang="ts">
    import { invoke } from '@tauri-apps/api/core';
    import { onMount } from 'svelte';
    import { ChevronRight, ChevronDown, Hash } from 'lucide-svelte';
    import { workspacesStore, currentWorkspaceIndex, openSearchTab, searchState } from '../../lib/stores';
    import { getWorkspaceNodes, extractFilePaths } from '../../lib/workspace/treeUtils';

    let isLoading = true;
    let expandedTags = new Set<string>(); // 展開状態のフルタグパスを保持
    let visibleNodes: FlatTagNode[] = []; // 画面に描画するリスト

    // === ツリー構築用の型定義 ===
    interface TagTreeNode {
        part: string;
        fullTag: string;
        count: number;
        children: Record<string, TagTreeNode>;
    }

    interface FlatTagNode {
        part: string;
        fullTag: string;
        count: number;
        depth: number;
        hasChildren: boolean;
        isExpanded: boolean;
        isVisible: boolean;
    }

    let rootTree: Record<string, TagTreeNode> = {};

    onMount(async () => {
        await loadTags();
    });

    async function loadTags() {
        isLoading = true;
        try {
            const nodes = getWorkspaceNodes($workspacesStore, $currentWorkspaceIndex);
            const filePaths = extractFilePaths(nodes);

            // Rustから { "tagA": 5, "project/B": 2 } のような形式で受け取る
            const tagCounts: Record<string, number> = await invoke('get_workspace_tags', { filePaths });

            rootTree = buildTree(tagCounts);
            updateVisibleNodes();
        } catch (e) {
            console.error("Failed to load tags:", e);
        } finally {
            isLoading = false;
        }
    }

    // スラッシュ区切りのタグをツリー構造オブジェクトに変換
    function buildTree(counts: Record<string, number>): Record<string, TagTreeNode> {
        const root: Record<string, TagTreeNode> = {};
        
        // アルファベット順に処理したい場合はソートする
        const sortedTags = Object.keys(counts).sort((a, b) => a.localeCompare(b));

        for (const fullTag of sortedTags) {
            const parts = fullTag.split('/');
            const count = counts[fullTag];
            
            let currentLevel = root;
            let accumulatedPath = '';

            for (let i = 0; i < parts.length; i++) {
                const part = parts[i];
                accumulatedPath = i === 0 ? part : `${accumulatedPath}/${part}`;
                
                if (!currentLevel[part]) {
                    currentLevel[part] = { part, fullTag: accumulatedPath, count: 0, children: {} };
                }
                
                // 末尾要素ならカウントを加算
                if (i === parts.length - 1) {
                    currentLevel[part].count += count;
                }
                
                currentLevel = currentLevel[part].children;
            }
        }
        return root;
    }

    // ツリー構造を、描画用のフラットな配列に変換する
    function updateVisibleNodes() {
        const result: FlatTagNode[] = [];

        function traverse(nodeRecord: Record<string, TagTreeNode>, depth: number, isParentVisible: boolean, parentExpanded: boolean) {
            const keys = Object.keys(nodeRecord).sort((a, b) => a.localeCompare(b));
            
            for (const key of keys) {
                const node = nodeRecord[key];
                const hasChildren = Object.keys(node.children).length > 0;
                const isExpanded = expandedTags.has(node.fullTag);
                const isVisible = isParentVisible && parentExpanded;

                if (isVisible) {
                    result.push({
                        part: node.part,
                        fullTag: node.fullTag,
                        count: node.count,
                        depth,
                        hasChildren,
                        isExpanded,
                        isVisible: true
                    });
                }
                traverse(node.children, depth + 1, isVisible, isExpanded);
            }
        }

        // 第1階層は常に親が(仮想的に)見えていて展開されている扱い
        traverse(rootTree, 0, true, true);
        visibleNodes = result;
    }

    // フォルダ的タグの開閉トグル
    function toggleExpand(fullTag: string, event: Event) {
        event.stopPropagation();
        if (expandedTags.has(fullTag)) {
            expandedTags.delete(fullTag);
        } else {
            expandedTags.add(fullTag);
        }
        expandedTags = expandedTags; // Svelteのリアクティビティをトリガー
        updateVisibleNodes();
    }

    // タグをクリックしたときに検索タブを起動
    function handleTagClick(fullTag: string) {
        openSearchTab();
        searchState.update(state => ({
            ...state,
            query: `#${fullTag}`,
            searchByFilename: false,
            hasSearched: false,
            autoRunSearch: true
        }));
    }
</script>

<div class="h-full flex flex-col">
    <!-- パネルヘッダー -->
    <div class="p-4 border-b flex items-center justify-between" style="border-color: color-mix(in srgb, var(--text-color) 10%, transparent);">
        <h3 class="font-bold text-sm opacity-80" style="color: var(--text-color);">タグ</h3>
        <button 
            on:click={loadTags} 
            class="text-xs opacity-50 hover:opacity-100 transition-opacity"
            title="再読み込み"
        >
            更新
        </button>
    </div>

    <!-- リスト部分 -->
    <div class="flex-1 overflow-y-auto p-2">
        {#if isLoading}
            <div class="text-sm opacity-50 text-center py-8">読み込み中...</div>
        {:else if visibleNodes.length === 0}
            <div class="text-sm opacity-50 text-center py-8">タグが見つかりません</div>
        {:else}
            {#each visibleNodes as node (node.fullTag)}
                <!-- svelte-ignore a11y-click-events-have-key-events -->
                <!-- svelte-ignore a11y-no-static-element-interactions -->
                <div 
                    class="flex items-center py-1 px-2 rounded cursor-pointer transition-colors text-sm hover:bg-[var(--active-highlight-bg)] group"
                    style="padding-left: {node.depth * 1.2 + 0.5}rem; color: var(--text-color);"
                    on:click={() => handleTagClick(node.fullTag)}
                >
                    <!-- 開閉矢印 (子要素がある場合のみ) -->
                    <div 
                        class="w-4 h-4 flex items-center justify-center mr-1 opacity-50 hover:opacity-100"
                        on:click={(e) => node.hasChildren && toggleExpand(node.fullTag, e)}
                    >
                        {#if node.hasChildren}
                            {#if node.isExpanded}
                                <ChevronDown size={14} />
                            {:else}
                                <ChevronRight size={14} />
                            {/if}
                        {/if}
                    </div>

                    <!-- アイコンと名前 -->
                    <Hash size={14} class="mr-1.5 opacity-60" style="color: var(--accent-color);" />
                    <span class="truncate flex-1">{node.part}</span>

                    <!-- カウントバッジ -->
                    {#if node.count > 0}
                        <span class="text-[10px] ml-2 px-1.5 rounded-full font-bold opacity-60 bg-black/10 dark:bg-white/10 group-hover:opacity-100">
                            {node.count}
                        </span>
                    {/if}
                </div>
            {/each}
        {/if}
    </div>
</div>
<!-- --- END OF src/components/RightSidebar/TagPanel.svelte --- -->