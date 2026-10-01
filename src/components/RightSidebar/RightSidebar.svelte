<!-- 責務: 右サイドバーの親枠。将来タブが増えた際の切り替えや閉じる処理を担う -->
<!-- --- START OF src/components/Editor/RightSidebar/RightSidebar.svelte --- -->
<script lang="ts">
    import { ListTree, Tags, PanelRightClose } from 'lucide-svelte';
    import OutlinePanel from './OutlinePanel.svelte';
    import TagPanel from './TagPanel.svelte';

    export let activeTab: any;
    export let onClose: () => void;
    
    let currentView = 'outline';

    // === リサイズ機能のロジック ===
    let sidebarWidth = 256; // 初期幅 (256px = w-64)
    const MIN_WIDTH = 200;
    const MAX_WIDTH = 600;

    let isResizing = false;
    let startX = 0;
    let startWidth = 0;

    function handleMousedown(e: MouseEvent) {
        isResizing = true;
        startX = e.clientX;
        startWidth = sidebarWidth;
        
        // ドラッグ中にテキストが選択されるのを防ぐ
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'col-resize';
    }

    function handleMousemove(e: MouseEvent) {
        if (!isResizing) return;
        
        // 右側から左へ引っ張ると幅が広がるため、移動量(e.clientX - startX)を引く
        const newWidth = startWidth - (e.clientX - startX);
        
        // 最小幅と最大幅の間に制限する
        if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
            sidebarWidth = newWidth;
        }
    }

    function handleMouseup() {
        if (isResizing) {
            isResizing = false;
            document.body.style.userSelect = '';
            document.body.style.cursor = '';
        }
    }
</script>

<!-- 
  svelte:window を使うことで、ドラッグ中にマウスがサイドバーの外（エディタ上など）
  に飛び出しても、リサイズ処理を途切れずに追従させることができます。
-->
<svelte:window 
    on:mousemove={handleMousemove} 
    on:mouseup={handleMouseup} 
/>

<!-- 幅をインラインスタイルで動的に指定し、相対配置(relative)にする -->
<div 
    class="h-full flex flex-col relative border-l" 
    style="width: {sidebarWidth}px; background-color: var(--menu-bg); border-color: color-mix(in srgb, var(--text-color) 10%, transparent);"
>
    <!-- 🔽 リサイズ用のハンドル (左端に配置) -->
    <!-- 普段は透明だが、ホバー・ドラッグ時にアクセントカラーで光らせる -->
    <div 
        class="absolute left-0 top-0 w-1.5 h-full cursor-col-resize z-10 transition-colors"
        style="
            transform: translateX(-50%);
            background-color: {isResizing ? 'var(--accent-color)' : 'transparent'};
        "
        on:mousedown={handleMousedown}
        on:mouseenter={(e) => { if(!isResizing) e.currentTarget.style.backgroundColor = 'color-mix(in srgb, var(--accent-color) 50%, transparent)'; }}
        on:mouseleave={(e) => { if(!isResizing) e.currentTarget.style.backgroundColor = 'transparent'; }}
    ></div>

    <!-- ヘッダー（アイコンタブ） -->
    <div class="flex items-center p-2 border-b gap-2" style="border-color: color-mix(in srgb, var(--text-color) 10%, transparent);">
        <button 
            on:click={() => currentView = 'outline'} 
            class="p-1 rounded transition-colors"
            style="background-color: {currentView === 'outline' ? 'var(--active-highlight-bg)' : 'transparent'};"
            title="アウトライン"
        >
            <ListTree size={18} />
        </button>
        <button 
            on:click={() => currentView = 'tags'} 
            class="p-1 rounded transition-colors opacity-50 hover:opacity-100"
            title="タグ (将来拡張用)"
        >
            <Tags size={18} />
        </button>
        
        <div class="flex-1"></div>
        
        <button 
            on:click={onClose} 
            class="p-1 rounded opacity-70 hover:opacity-100"
            title="閉じる"
            on:mouseenter={(e) => e.currentTarget.style.backgroundColor = 'var(--active-highlight-bg)'}
            on:mouseleave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
            <PanelRightClose size={18} />
        </button>
    </div>
    
    <!-- コンテンツ -->
    <div class="flex-1 overflow-hidden">
        {#if currentView === 'outline'}
            <OutlinePanel {activeTab} on:jump />
        {:else}
            <TagPanel />
        {/if}
    </div>
</div>
<!-- --- END OF src/components/Editor/RightSidebar/RightSidebar.svelte --- -->