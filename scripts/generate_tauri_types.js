// Rust側のデータモデルと#[tauri::command]を解析し、TypeScriptの型定義・IPCマップを自動生成する
import fs from 'fs';
import path from 'path';

const RUST_SRC_DIR = path.join(process.cwd(), 'src-tauri', 'src');
const OUTPUT_FILE = path.join(process.cwd(), 'src', 'lib', 'tauri', 'generated.ts');

export const Parser = {
    /** snake_case を camelCase に変換する */
    snakeToCamel(name) {
        return name.replace(/_([a-z0-9])/g, (_, ch) => ch.toUpperCase());
    },

    /** トップレベルの区切り文字で文字列を分割する（<>, (), {} のネストを考慮） */
    splitTopLevel(input, delimiter = ',') {
        const parts = [];
        let current = '';
        let angle = 0;
        let paren = 0;
        let brace = 0;
        let bracket = 0;

        for (let i = 0; i < input.length; i++) {
            const ch = input[i];
            if (ch === '<') angle++;
            else if (ch === '>' && angle > 0) angle--;
            else if (ch === '(') paren++;
            else if (ch === ')' && paren > 0) paren--;
            else if (ch === '{') brace++;
            else if (ch === '}' && brace > 0) brace--;
            else if (ch === '[') bracket++;
            else if (ch === ']' && bracket > 0) bracket--;

            if (ch === delimiter && angle === 0 && paren === 0 && brace === 0 && bracket === 0) {
                if (current.trim()) parts.push(current.trim());
                current = '';
            } else {
                current += ch;
            }
        }
        if (current.trim()) parts.push(current.trim());
        return parts;
    },

    /** Rust型をTypeScript型に変換する */
    rustTypeToTs(rustType) {
        let t = rustType.trim().replace(/^&\s*/, '');
        if (!t || t === '()') return 'void';

        if (t === 'String' || t === 'str') return 'string';
        if (t === 'bool') return 'boolean';
        if (/^(?:u|i)(?:8|16|32|64|128|size)|f(?:32|64)$/.test(t)) return 'number';

        if (t.startsWith('Option<') && t.endsWith('>')) {
            const inner = t.slice('Option<'.length, -1);
            const innerTs = this.rustTypeToTs(inner);
            return innerTs.includes('| null') ? innerTs : `${innerTs} | null`;
        }

        if (t.startsWith('Vec<') && t.endsWith('>')) {
            const inner = t.slice('Vec<'.length, -1);
            const innerTs = this.rustTypeToTs(inner);
            return innerTs.includes('|') || innerTs.includes(' ') ? `(${innerTs})[]` : `${innerTs}[]`;
        }

        if ((t.startsWith('HashMap<') || t.startsWith('BTreeMap<')) && t.endsWith('>')) {
            const inner = t.slice(t.indexOf('<') + 1, -1);
            const [k, v] = this.splitTopLevel(inner, ',');
            return `Record<${this.rustTypeToTs(k || 'string')}, ${this.rustTypeToTs(v || 'unknown')}>`;
        }

        if (t.startsWith('Result<') && t.endsWith('>')) {
            const inner = t.slice('Result<'.length, -1);
            const [okType] = this.splitTopLevel(inner, ',');
            return this.rustTypeToTs(okType || 'void');
        }

        return t;
    },

    /** 行コメントを除去したコードを取得する（文字列リテラル外の // コメント） */
    stripLineComments(content) {
        return content
            .split('\n')
            .map(line => {
                let inQuote = false;
                let quoteChar = '';
                for (let i = 0; i < line.length; i++) {
                    const ch = line[i];
                    if (inQuote) {
                        if (ch === '\\') { i++; continue; }
                        if (ch === quoteChar) inQuote = false;
                    } else {
                        if (ch === '"' || ch === "'") {
                            inQuote = true;
                            quoteChar = ch;
                        } else if (ch === '/' && line[i + 1] === '/') {
                            return line.slice(0, i);
                        }
                    }
                }
                return line;
            })
            .join('\n');
    },

    /** 開始位置の '{' に対応する '}' のインデックスを返す */
    findMatchingBrace(text, openBraceIndex) {
        let depth = 0;
        let inString = false;
        for (let i = openBraceIndex; i < text.length; i++) {
            const ch = text[i];
            if (inString) {
                if (ch === '\\') { i++; continue; }
                if (ch === '"') inString = false;
            } else {
                if (ch === '"') inString = true;
                else if (ch === '{') depth++;
                else if (ch === '}') {
                    depth--;
                    if (depth === 0) return i;
                }
            }
        }
        return -1;
    },

    /** 属性ブロック（#[...]）から serde 属性情報を抽出する */
    parseSerdeAttrs(attrText) {
        const renameAllMatch = attrText.match(/#\[serde\([^\)]*rename_all\s*=\s*"([^"]+)"/);
        const renameMatch = attrText.match(/#\[serde\([^\)]*rename\s*=\s*"([^"]+)"/);
        const tagMatch = attrText.match(/#\[serde\([^\)]*tag\s*=\s*"([^"]+)"/);
        return {
            renameAll: renameAllMatch ? renameAllMatch[1] : null,
            rename: renameMatch ? renameMatch[1] : null,
            tag: tagMatch ? tagMatch[1] : null
        };
    },
    /** 構造体ボディからフィールド一覧をパースする */
    parseStructFields(body, renameAll = null) {
        const lines = body.split('\n');
        const fields = [];
        let pendingAttrs = '';
        let buffer = '';

        const pushField = (entryText) => {
            const match = entryText.match(/^(?:pub(?:\([^)]*\))?\s+)?([A-Za-z0-9_]+)\s*:\s*([\s\S]+)$/);
            if (!match) return;
            const rawName = match[1];
            const rawType = match[2].trim();
            const attrs = this.parseSerdeAttrs(pendingAttrs);
            const fieldName = attrs.rename
                ? attrs.rename
                : renameAll === 'camelCase'
                    ? this.snakeToCamel(rawName)
                    : rawName;
            const isOptional = rawType.startsWith('Option<') && rawType.endsWith('>');
            fields.push({
                name: fieldName,
                tsType: this.rustTypeToTs(rawType),
                optional: isOptional
            });
        };

        for (const rawLine of lines) {
            const trimmed = rawLine.trim();
            if (!trimmed) continue;

            if (trimmed.startsWith('#[')) {
                pendingAttrs += ' ' + trimmed;
                continue;
            }

            buffer += (buffer ? ' ' : '') + trimmed;
            if (!trimmed.endsWith(',')) continue;

            pushField(buffer.replace(/,$/, '').trim());
            buffer = '';
            pendingAttrs = '';
        }

        if (buffer.trim()) {
            pushField(buffer.trim());
        }

        return fields;
    },

    /** Rustコードから pub struct / pub enum を抽出する */
    extractModels(content) {
        const cleaned = this.stripLineComments(content);
        const models = [];
        const declRegex = /((?:\s*#\[[^\]]*\]\s*)*)pub\s+(struct|enum)\s+([A-Za-z0-9_]+)\s*\{/g;
        let match;

        while ((match = declRegex.exec(cleaned)) !== null) {
            const attrText = match[1] || '';
            const kind = match[2];
            const name = match[3];
            const openBraceIndex = match.index + match[0].length - 1;
            const closeBraceIndex = this.findMatchingBrace(cleaned, openBraceIndex);
            if (closeBraceIndex === -1) continue;

            const body = cleaned.slice(openBraceIndex + 1, closeBraceIndex);
            const attrs = this.parseSerdeAttrs(attrText);

            if (kind === 'struct') {
                models.push({
                    kind: 'interface',
                    name,
                    fields: this.parseStructFields(body, attrs.renameAll)
                });
            } else if (kind === 'enum') {
                const variants = [];
                let cursor = 0;
                while (cursor < body.length) {
                    const remaining = body.slice(cursor);
                    const vMatch = remaining.match(/^\s*(?:(?:#\[[^\]]*\]\s*)*)([A-Za-z0-9_]+)\s*(\{|,|$)/);
                    if (!vMatch) {
                        const nextComma = remaining.indexOf(',');
                        if (nextComma === -1) break;
                        cursor += nextComma + 1;
                        continue;
                    }
                    const variantName = vMatch[1];
                    const delim = vMatch[2];
                    if (delim === '{') {
                        const vOpen = cursor + vMatch[0].length - 1;
                        const vClose = this.findMatchingBrace(body, vOpen);
                        if (vClose === -1) break;
                        const vBody = body.slice(vOpen + 1, vClose);
                        variants.push({
                            name: variantName,
                            fields: this.parseStructFields(vBody, attrs.renameAll)
                        });
                        cursor = vClose + 1;
                        while (cursor < body.length && (body[cursor] === ',' || /\s/.test(body[cursor]))) cursor++;
                    } else {
                        variants.push({ name: variantName, fields: [] });
                        cursor += vMatch[0].length;
                    }
                }
                models.push({ kind: 'enum', name, tag: attrs.tag, variants });
            }

            declRegex.lastIndex = closeBraceIndex + 1;
        }

        return models;
    },
    /** #[tauri::command] 関数を抽出する */
    extractCommands(content, sourceFile = '') {
        const cleaned = this.stripLineComments(content);
        const commands = [];
        const cmdRegex = /#\[tauri::command\]\s*(?:pub\s+)?(?:async\s+)?fn\s+([A-Za-z0-9_]+)\s*\(([\s\S]*?)\)\s*(?:->\s*([^\{]+?))?\s*\{/g;
        let match;

        while ((match = cmdRegex.exec(cleaned)) !== null) {
            const name = match[1];
            const rawParams = match[2].trim();
            const rawReturn = (match[3] || '()').trim();

            const args = [];
            if (rawParams) {
                const paramParts = this.splitTopLevel(rawParams, ',');
                for (const part of paramParts) {
                    const pMatch = part.match(/^(?:mut\s+)?([A-Za-z0-9_]+)\s*:\s*([\s\S]+)$/);
                    if (!pMatch) continue;
                    const paramName = pMatch[1];
                    const paramType = pMatch[2].trim();

                    if (/^(?:tauri::)?(?:AppHandle|Window|WebviewWindow)$/.test(paramType) || paramType.startsWith('State<') || paramType.startsWith('tauri::State<')) {
                        continue;
                    }

                    const isOptional = paramType.startsWith('Option<') && paramType.endsWith('>');
                    args.push({
                        name: this.snakeToCamel(paramName),
                        tsType: this.rustTypeToTs(paramType),
                        optional: isOptional
                    });
                }
            }

            commands.push({
                name,
                sourceFile,
                args,
                returnType: this.rustTypeToTs(rawReturn)
            });
        }

        return commands;
    },

    /** lib.rs の generate_handler![...] に登録されているコマンド一覧を抽出する */
    extractRegisteredHandlers(libRsContent) {
        const cleaned = this.stripLineComments(libRsContent);
        const match = cleaned.match(/tauri::generate_handler!\[([\s\S]*?)\]/);
        if (!match) return new Set();
        return new Set(
            match[1]
                .split(',')
                .map(s => s.trim())
                .filter(Boolean)
                .map(s => s.split('::').pop())
        );
    }
};

function renderTs(models, commands) {
    const lines = [
        '// Rust側のデータモデルおよびTauri IPCコマンドの自動生成型定義（手動編集禁止）',
        '// 再生成コマンド: npm run doc:tauri',
        '',
        "import { invoke } from '@tauri-apps/api/core';",
        '',
        '// ============================================',
        '// 1. データモデル (Rust struct / enum 由来)',
        '// ============================================',
        ''
    ];

    for (const model of models) {
        if (model.kind === 'interface') {
            lines.push(`export interface ${model.name} {`);
            for (const f of model.fields) {
                const opt = f.optional ? '?' : '';
                lines.push(`    ${f.name}${opt}: ${f.tsType};`);
            }
            lines.push('}');
            lines.push('');
        } else if (model.kind === 'enum') {
            if (model.tag) {
                const variantTypes = model.variants.map(v => {
                    if (v.fields.length === 0) {
                        return `{ ${model.tag}: '${v.name}' }`;
                    }
                    const fieldStr = v.fields
                        .map(f => `${f.name}${f.optional ? '?' : ''}: ${f.tsType}`)
                        .join('; ');
                    return `{ ${model.tag}: '${v.name}'; ${fieldStr} }`;
                });
                lines.push(`export type ${model.name} =`);
                variantTypes.forEach((vt, idx) => {
                    const suffix = idx === variantTypes.length - 1 ? ';' : '';
                    lines.push(`    | ${vt}${suffix}`);
                });
                lines.push('');
            } else {
                const variantNames = model.variants.map(v => `'${v.name}'`).join(' | ');
                lines.push(`export type ${model.name} = ${variantNames};`);
                lines.push('');
            }
        }
    }

    lines.push('// ============================================');
    lines.push('// 2. Tauri IPC コマンド一覧 (#[tauri::command] 由来)');
    lines.push('// ※ 注意: save_workspaces / save_file_content は直接 invoke せず、');
    lines.push('//   必ず workspaceManager.ts / fileManager.ts のキュー関数を使用してください。');
    lines.push('// ============================================');
    lines.push('');
    lines.push('export interface TauriCommandMap {');

    for (const cmd of commands) {
        const argsType = cmd.args.length === 0
            ? 'void'
            : `{ ${cmd.args.map(a => `${a.name}${a.optional ? '?' : ''}: ${a.tsType}`).join('; ')} }`;
        lines.push(`    /** defined in src-tauri/src/${cmd.sourceFile} */`);
        lines.push(`    ${cmd.name}: {`);
        lines.push(`        args: ${argsType};`);
        lines.push(`        return: ${cmd.returnType};`);
        lines.push('    };');
    }

    lines.push('}');
    lines.push('');
    lines.push('export type TauriCommandName = keyof TauriCommandMap;');
    lines.push('');
    lines.push('/**');
    lines.push(' * 型安全な Tauri invoke ラッパー');
    lines.push(' */');
    lines.push('export async function invokeCommand<K extends TauriCommandName>(');
    lines.push('    command: K,');
    lines.push("    ...args: TauriCommandMap[K]['args'] extends void ? [] : [args: TauriCommandMap[K]['args']]");
    lines.push("): Promise<TauriCommandMap[K]['return']> {");
    lines.push("    return invoke<TauriCommandMap[K]['return']>(command, args[0] as Record<string, unknown> | undefined);");
    lines.push('}');
    lines.push('');

    return lines.join('\n');
}

export function generateTauriTypes() {
    if (!fs.existsSync(RUST_SRC_DIR)) {
        throw new Error(`Rust source directory not found: ${RUST_SRC_DIR}`);
    }

    const rsFiles = fs.readdirSync(RUST_SRC_DIR)
        .filter(f => f.endsWith('.rs'))
        .sort((a, b) => {
            if (a === 'models.rs') return -1;
            if (b === 'models.rs') return 1;
            return a.localeCompare(b);
        });

    const models = [];
    const seenModels = new Set();
    const commands = [];

    let registeredHandlers = new Set();
    const libPath = path.join(RUST_SRC_DIR, 'lib.rs');
    if (fs.existsSync(libPath)) {
        registeredHandlers = Parser.extractRegisteredHandlers(fs.readFileSync(libPath, 'utf8'));
    }

    for (const file of rsFiles) {
        const rawContent = fs.readFileSync(path.join(RUST_SRC_DIR, file), 'utf8');
        const content = rawContent.split('#[cfg(test)]')[0];
        for (const m of Parser.extractModels(content)) {
            if (!seenModels.has(m.name)) {
                seenModels.add(m.name);
                models.push(m);
            }
        }
        for (const cmd of Parser.extractCommands(content, file)) {
            if (registeredHandlers.size === 0 || registeredHandlers.has(cmd.name)) {
                commands.push(cmd);
            }
        }
    }

    commands.sort((a, b) => a.name.localeCompare(b.name));

    const outputDir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    const tsContent = renderTs(models, commands);
    fs.writeFileSync(OUTPUT_FILE, tsContent, 'utf8');
    console.log(`✅ ${OUTPUT_FILE} を出力しました！（モデル ${models.length}件 / コマンド ${commands.length}件）`);
}

if (process.argv[1] === new URL(import.meta.url).pathname || process.argv[1] === import.meta.filename) {
    generateTauriTypes();
}
