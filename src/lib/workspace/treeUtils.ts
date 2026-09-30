// ワークスペースのノードツリー最新化およびスマートフォルダ評価、ワークスペースのファイル一覧取得
import { invoke } from '@tauri-apps/api/core';


/**
 * ピン留めされた情報から、ツリー上の実体ノードを再帰的に検索する
 */
export function getPinnedNode(pin: any, workspace: any) {
  if (!workspace) return pin;

  function findNode(nodes: any[]): any {
    for (const n of nodes) {
      const path = n.type === 'Folder' ? n.original_path : n.path;
      if (n.type === pin.item_type && n.name === pin.name && path === pin.path) return n;
      if (n.children) {
        const found = findNode(n.children);
        if (found) return found;
      }
    }
    return null;
  }

  let realNode = findNode(workspace.nodes);
  if (realNode) return realNode;

  return { type: pin.item_type, name: pin.name, path: pin.path, original_path: pin.path, children: [] };
}

/**
 * フォルダとファイルを区別してソートする純粋関数
 */
export function getSortedNodes(nodes: any[], sortBy = 'name', sortOrder = 'asc') {
  if (!nodes) return [];
  return [...nodes].sort((a, b) => {
    const isDirA = a.type === 'Folder';
    const isDirB = b.type === 'Folder';
    if (isDirA !== isDirB) return isDirA ? -1 : 1;
    
    let comp = 0;
    if (sortBy === 'created') comp = (a.created || 0) - (b.created || 0);
    else if (sortBy === 'modified') comp = (a.modified || 0) - (b.modified || 0);
    else comp = a.name.localeCompare(b.name);
    
    return sortOrder === 'asc' ? comp : -comp;
  });
}


/**
 * ノード配列をカテゴリごとにグループ化し、指定されたカテゴリ順に従って配列を構成する
 */
export function groupNodesByCategory(nodes: any[], categoryOrder: string[] = [], sortBy = 'name', sortOrder = 'asc') {
  if (!nodes) return { groups: {}, sortedCategories: [] };
  
  const groups: Record<string, any[]> = {};
  
  // 全ノードをカテゴリごとに分ける
  for (const node of nodes) {
    const category = node.category || ''; // 未設定・空文字は「カテゴリなし」
    if (!groups[category]) groups[category] = [];
    groups[category].push(node);
  }
  
  // 各グループ内で既存のソートを適用
  for (const key in groups) {
    groups[key] = getSortedNodes(groups[key], sortBy, sortOrder);
  }
  
  const existingCategories = Object.keys(groups);
  const sortedCategories: string[] = [];
  
  // 「カテゴリなし（空文字）」は常に一番上に固定する
  if (existingCategories.includes('')) {
    sortedCategories.push('');
  }
  
  // 記憶された並び順に従って追加
  for (const cat of categoryOrder) {
    if (cat !== '' && existingCategories.includes(cat) && !sortedCategories.includes(cat)) sortedCategories.push(cat);
  }
  
  // 記憶されていない新しいカテゴリは末尾に追加
  for (const cat of existingCategories) {
    if (!sortedCategories.includes(cat)) sortedCategories.push(cat);
  }

  return { groups, sortedCategories };
}

/** パスの表記ゆれ（スラッシュ・バックスラッシュ・大文字小文字）を統一する補助関数 */
function normalizePath(p: string | undefined | null): string {
  if (!p) return '';
  return p.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
}

// 親のソート設定を引き継ぐためのオプショナル引数を追加
export async function refreshTree(nodes: any[], workspaceNodes: any[], parentSortBy?: string, parentSortOrder?: string): Promise<any[]> {
  const updatedNodes = [];

  for (let node of nodes) {
    if (node.type === 'Folder' && node.original_path) {
            // 現在のノードに適用すべきソート設定を解決する
      const currentSortBy = node.sort_by || parentSortBy;
      const currentSortOrder = node.sort_order || parentSortOrder;

      if (node.smart_rules) {
        try {
          const children = await invoke('evaluate_smart_folder', { 
            rules: node.smart_rules, 
            workspaceNodes 
          });
          node.children = children as any[];
        } catch {}
      } else {
        try {
          // 💥 1. 自身のソート設定を使ってディスクから中身を読み込む
          let freshChildren: any[] = await invoke('read_directory', { 
              path: node.original_path,
              sortBy: currentSortBy || null,
              sortOrder: currentSortOrder || null
          });
          // 💥 2. 以前の階層情報をパスで引けるようにMap化
          const oldChildrenMap = new Map();
          if (node.children) {
            for (const c of node.children) {
               const key = normalizePath(c.original_path || c.path || c.name);
              oldChildrenMap.set(key, c);
            }
          }
          // 💥 3. ディスクから読んだ新しいアイテムに、前回の設定（sort_by, category等）を完全に復元
          for (let fresh of freshChildren) {
            const freshKey = normalizePath(fresh.original_path || fresh.path || fresh.name);
            if (oldChildrenMap.has(freshKey)) {
              const old = oldChildrenMap.get(freshKey);
              fresh.name = old.name;
              fresh.sort_by = old.sort_by;
              fresh.sort_order = old.sort_order;
              fresh.category = old.category;
              fresh.children = old.children || [];
            }
          }
          // 💥 4. 設定が復元された freshChildren を次の階層へ渡して再帰処理を行う
          node.children = await refreshTree(freshChildren, workspaceNodes, currentSortBy, currentSortOrder);
        } catch (e) {}
      }
    }
    updatedNodes.push(node);
  }
  return updatedNodes;
}

// ワークスペースと関連ライブラリのノードをマージして取得する共通関数
export function getWorkspaceNodes(
    workspaces: any[],
    workspaceIndex: number,

): any[] {
    const currentWs = workspaces[workspaceIndex];
    if (!currentWs) return [];

    let targetNodes = [...(currentWs.nodes || [])];

    return targetNodes;
}

/**
 * ワークスペースのノード群から、「ファイル名(小文字・拡張子なし) → ノードの配列」の辞書を作成します。
 * 将来の Wikiリンク や 引用(![[...]]) の解決を O(1) で高速に行うためのインデックスです。
 */
export function buildFilenameIndex(nodes: any[]): Map<string, any[]> {
    const map = new Map<string, any[]>();
    
    function traverse(nodeList: any[]) {
        for (const node of nodeList) {
            if (node.type === 'File') {
                const name = node.name || node.title || node.path?.split(/[/\\]/).pop() || '';
                const dotIndex = name.lastIndexOf('.');
                const baseName = dotIndex !== -1 ? name.substring(0, dotIndex) : name;
                const key = baseName.trim().toLowerCase();

                if (!map.has(key)) map.set(key, []);
                map.get(key)!.push(node);
            } else if (node.type === 'Folder' && node.children) {
                traverse(node.children);
            }
        }
    }
    
    traverse(nodes);
    return map;
}

/**
 * JS側で完結する高速なファイル名部分一致検索。
 * Rustに巨大なJSONを送らずに、検索タブ用の結果配列を生成します。
 */
export function searchFilesByName(nodes: any[], query: string): any[] {
    const results: any[] = [];
    const queryLower = query.trim().toLowerCase();
    if (!queryLower) return results;

    function traverse(nodeList: any[]) {
        for (const node of nodeList) {
            if (node.type === 'File') {
                const name = node.name || node.title || node.path?.split(/[/\\]/).pop() || '';
                if (name.toLowerCase().includes(queryLower)) {
                    results.push({ path: node.path || node.original_path, name, snippet: "(ファイル名に一致)" });
                }
            } else if (node.type === 'Folder' && node.children) {
                traverse(node.children);
            }
        }
    }
    
    traverse(nodes);
    return results;
}

/**
 * ノードツリーからファイルのパスのみを抽出し、フラットな文字列配列を生成します。
 * 巨大なツリーオブジェクト全体をRustへ送るIPC通信のオーバーヘッドを削減するために使用します。
 */
export function extractFilePaths(nodes: any[]): string[] {
    const paths = new Set<string>(); // 重複排除のためにSetを使用
    
    function traverse(nodeList: any[]) {
        for (const node of nodeList) {
            if (node.type === 'File' && (node.path || node.original_path)) {
                paths.add(node.path || node.original_path);
            } else if (node.type === 'Folder' && node.children) {
                traverse(node.children);
            }
        }
    }
    
    traverse(nodes);
    return Array.from(paths);
}