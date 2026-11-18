import { describe, it, expect } from 'vitest';
import { Parser } from './generate_tauri_types.js';

describe('generate_tauri_types Parser', () => {
    describe('rustTypeToTs', () => {
        it('Rustの基本型・Vec・Option・Result・HashMapをTypeScript型に変換できる', () => {
            expect(Parser.rustTypeToTs('String')).toBe('string');
            expect(Parser.rustTypeToTs('u64')).toBe('number');
            expect(Parser.rustTypeToTs('bool')).toBe('boolean');
            expect(Parser.rustTypeToTs('Vec<u8>')).toBe('number[]');
            expect(Parser.rustTypeToTs('Option<String>')).toBe('string | null');
            expect(Parser.rustTypeToTs('Result<Vec<VirtualNode>, String>')).toBe('VirtualNode[]');
            expect(Parser.rustTypeToTs('Result<Option<String>, String>')).toBe('string | null');
            expect(Parser.rustTypeToTs('Result<(), String>')).toBe('void');
            expect(Parser.rustTypeToTs('HashMap<String, u32>')).toBe('Record<string, number>');
        });
    });

    describe('extractModels', () => {
        it('serde(rename_all = "camelCase") と serde(rename = "...") を反映した struct を抽出できる', () => {
            const rust = `
                #[derive(Debug, Serialize, Deserialize)]
                #[serde(rename_all = "camelCase")]
                pub struct SampleItem {
                    pub file_path: String,
                    pub line_number: usize,
                    #[serde(rename = "customKey")]
                    pub raw_key: Option<bool>,
                }
            `;
            const models = Parser.extractModels(rust);
            expect(models).toEqual([
                {
                    kind: 'interface',
                    name: 'SampleItem',
                    fields: [
                        { name: 'filePath', tsType: 'string', optional: false },
                        { name: 'lineNumber', tsType: 'number', optional: false },
                        { name: 'customKey', tsType: 'boolean | null', optional: true }
                    ]
                }
            ]);
        });

        it('serde(tag = "...") 付きの enum を抽出できる', () => {
            const rust = `
                #[derive(Debug, Serialize, Deserialize)]
                #[serde(tag = "type")]
                pub enum VirtualNode {
                    Folder {
                        name: String,
                        original_path: Option<String>,
                    },
                    File {
                        name: String,
                        path: String,
                    },
                }
            `;
            const models = Parser.extractModels(rust);
            expect(models).toEqual([
                {
                    kind: 'enum',
                    name: 'VirtualNode',
                    tag: 'type',
                    variants: [
                        {
                            name: 'Folder',
                            fields: [
                                { name: 'name', tsType: 'string', optional: false },
                                { name: 'original_path', tsType: 'string | null', optional: true }
                            ]
                        },
                        {
                            name: 'File',
                            fields: [
                                { name: 'name', tsType: 'string', optional: false },
                                { name: 'path', tsType: 'string', optional: false }
                            ]
                        }
                    ]
                }
            ]);
        });
    });

    describe('extractCommands', () => {
        it('AppHandle を除外し、引数を camelCase 化して #[tauri::command] を抽出できる', () => {
            const rust = `
                #[tauri::command]
                pub async fn save_file_content(
                    app: AppHandle,
                    path: String,
                    last_modified: u64,
                    force: Option<bool>,
                ) -> Result<u64, String> {
                    Ok(0)
                }
            `;
            const cmds = Parser.extractCommands(rust, 'file_ops.rs');
            expect(cmds).toEqual([
                {
                    name: 'save_file_content',
                    sourceFile: 'file_ops.rs',
                    args: [
                        { name: 'path', tsType: 'string', optional: false },
                        { name: 'lastModified', tsType: 'number', optional: false },
                        { name: 'force', tsType: 'boolean | null', optional: true }
                    ],
                    returnType: 'number'
                }
            ]);
        });
    });
});
