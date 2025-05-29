import fs from 'node:fs/promises';
import path from 'node:path';
import yaml from 'yaml';
import { env } from '~/lib/env';
import type { TableDefinition } from './tableCard';

export type CardRow = {
    flag: string;
    field: string;
    attrs: string;
};

export type CardTemplate = {
    rows: CardRow[];
};

export type CardModel = {
    Front: string;
    Back: string;
};

export type NoteTemplate = {
    noteType: string;
    language: string;
    deckName: string;
    fieldDescriptions: Record<string, string>;
    fieldGroups: string[][];
    fieldLangs: Record<string, string>;
    requiredFields: string[];
    cardDescriptions: Record<string, string>;
    cards: Record<string, CardTemplate>;
    // New: table definitions for row-oriented format
    tableDefinitions?: TableDefinition[];
};

export type ProcessedNoteTemplate = Omit<NoteTemplate, 'cards'> & {
    cards: Record<string, CardModel>;
    // Computed field for easy access to table definitions
    tableDefinitions: TableDefinition[];
};

export type Templates = Record<string, ProcessedNoteTemplate>;

function escapeHTMLAttribute(str: string): string {
    return str.replace(/"/g, "&quot;");
}

export const cards = ({ language, fieldGroups, fieldLangs, cards }: NoteTemplate): Record<string, CardModel> => {
    const cardModels: Record<string, CardModel> = {};
    for (const [cardName, { rows }] of Object.entries(cards)) {
        const r = [];
        const frontFirstRow = `<div class='bsp-card front' data-lang='${language}'>`;
        const backFirstRow = `<div class='bsp-card back' data-lang='${language}'>`;
        r.push(`<table data-debug class='pairs_table speakchild'>`);
        for (const { flag, field, attrs } of rows) {
            r.push(`<tr><td><div class="${flag}"></div></td><td ${attrs} data-field-display="${field}"></td></tr>`);
        }
        r.push("</table>");
        r.push(
            `<div class="hide hiddenCardData" data-field-groups="${escapeHTMLAttribute(JSON.stringify(fieldGroups))}" data-field-langs="${escapeHTMLAttribute(JSON.stringify(fieldLangs))}">`,
        );
        for (const field of fieldGroups.flat()) {
            r.push(`<div data-field-data="${field}">{{${field}}}</div>`);
        }
        r.push("</div>");
        r.push('<div class="only-back backData">');
        r.push("{{#Mnemonic}}<div>{{Mnemonic}}</div>{{/Mnemonic}}");
        r.push("{{#Related}}<div>{{Related}}</div>{{/Related}}");
        r.push("</div>");
        r.push("</div>");
        cardModels[cardName] = {
            Front: [frontFirstRow, ...r].join("\n"),
            Back: [backFirstRow, ...r].join("\n"),
        };
    }
    return cardModels;
};

/**
 * Generate table definitions from fieldGroups for backward compatibility
 */
function generateTableDefinitionsFromFieldGroups(
    fieldGroups: string[][],
    fieldLangs: Record<string, string>
): TableDefinition[] {
    return fieldGroups.map((group, index) => {
        const tableName = index === 0 ? 'main' : `table${index}`;

        // Try to identify what this table represents based on field names
        let description = `Table ${index + 1}`;
        if (group.some(field => field.toLowerCase().includes('extra'))) {
            description = 'Additional examples and context';
        } else if (index === 0) {
            description = 'Main vocabulary items';
        }

        // Generate column descriptions based on common patterns
        const columnDescriptions: Record<string, string> = {};
        for (const column of group) {
            if (column === 'EN') {
                columnDescriptions[column] = 'English translation or equivalent';
            } else if (column.includes('EN')) {
                columnDescriptions[column] = 'English descriptions or translations';
            } else if (column === 'FR') {
                columnDescriptions[column] = 'French text (words, phrases, or sentences)';
            } else if (column.includes('FR')) {
                columnDescriptions[column] = 'French conjugations, declensions, or forms';
            } else if (column === 'DE') {
                columnDescriptions[column] = 'German text (words, phrases, or sentences)';
            } else if (column === 'ZH') {
                columnDescriptions[column] = 'Simplified Chinese characters';
            } else if (column === 'Hant') {
                columnDescriptions[column] = 'Traditional Chinese characters';
            } else if (column === 'Pinyin') {
                columnDescriptions[column] = 'Pinyin romanization with tone marks';
            } else if (column === 'JP') {
                columnDescriptions[column] = 'Japanese text (kanji, hiragana, katakana)';
            } else if (column === 'Kana') {
                columnDescriptions[column] = 'Kana reading (hiragana or katakana)';
            } else {
                // Fallback based on field language
                const lang = fieldLangs[column];
                if (lang === 'en') {
                    columnDescriptions[column] = 'English content';
                } else if (lang) {
                    columnDescriptions[column] = `${lang.toUpperCase()} content`;
                } else {
                    columnDescriptions[column] = `${column} content`;
                }
            }
        }

        return {
            name: tableName,
            description,
            columns: group,
            columnDescriptions,
            rowDescriptions: {
                'Word': 'Dictionary form of the word/phrase',
                'Sentence1': 'Primary example sentence',
                'Sentence2': 'Secondary example sentence',
                'Example1': 'First usage example',
                'Example2': 'Second usage example',
                'Context1': 'First context example',
                'Context2': 'Second context example',
            }
        };
    });
}

// Cache templates in memory
let templatesCache: Templates | null = null;

export async function loadTemplates(): Promise<Templates> {
    // if (templatesCache) {
    //     return templatesCache;
    // }

    const templates: Templates = {};
    const entries = await fs.readdir(env.DATA_REPO_PATH, { withFileTypes: true });

    for (const entry of entries) {
        if (!entry.isDirectory() || entry.name === '.git') continue;

        const language = entry.name;
        const notePath = path.join(env.DATA_REPO_PATH, language, 'note.yaml');

        try {
            const noteContent = await fs.readFile(notePath, 'utf-8');
            const template = yaml.parse(noteContent) as NoteTemplate;

            // Convert the YAML card templates into Anki card models
            const cardModels = cards(template);

            // Generate table definitions if not provided
            const tableDefinitions = template.tableDefinitions ||
                generateTableDefinitionsFromFieldGroups(template.fieldGroups, template.fieldLangs);

            // Filter out RowOrder fields from fieldDescriptions since they're auto-generated
            const filteredFieldDescriptions = { ...template.fieldDescriptions };
            for (const tableDef of tableDefinitions) {
                const orderFieldName = tableDef.name === 'main' ? 'RowOrder' : `${tableDef.name.charAt(0).toUpperCase() + tableDef.name.slice(1)}RowOrder`;
                delete filteredFieldDescriptions[orderFieldName];
            }

            templates[language] = {
                ...template,
                fieldDescriptions: filteredFieldDescriptions,
                cards: cardModels,
                tableDefinitions,
            };
        } catch (error) {
            console.error(`Failed to load template for ${language}:`, error);
        }
    }

    templatesCache = templates;
    return templates;
}

export async function validateNote(
    noteType: string,
    note: Record<string, string>,
    templates: Templates,
): Promise<{ isValid: boolean; error?: string }> {
    const errors = [];

    const template = Object.values(templates).find(t => t.noteType === noteType);
    if (!template) {
        errors.push(`Note type "${noteType}" not found.`);
    } else {
        // Separate required fields into table columns and non-table fields for clearer error messages
        const tableColumns = new Set<string>();
        const rowOrderFields = new Set<string>();

        for (const tableDef of template.tableDefinitions) {
            tableDef.columns.forEach(col => tableColumns.add(col));
            const orderFieldName = tableDef.name === 'main' ? 'RowOrder' : `${tableDef.name.charAt(0).toUpperCase() + tableDef.name.slice(1)}RowOrder`;
            rowOrderFields.add(orderFieldName);
        }

        // Check for missing required fields, but be more specific about the type
        const missingTableFields = template.requiredFields.filter(
            (field) => !note[field] && tableColumns.has(field)
        );
        const missingNonTableFields = template.requiredFields.filter(
            (field) => !note[field] && !tableColumns.has(field)
        );

        if (missingNonTableFields.length > 0) {
            errors.push(`Missing required non-table fields: ${missingNonTableFields.join(", ")}.`);
        }
        if (missingTableFields.length > 0) {
            errors.push(`Missing required table data for columns: ${missingTableFields.join(", ")}. Make sure your tables contain data for these columns.`);
        }

        // Get all valid fields (existing fields + table columns + row order fields)
        const validFields = new Set(Object.keys(template.fieldDescriptions));

        // Add table columns as valid fields
        for (const tableDef of template.tableDefinitions) {
            tableDef.columns.forEach(col => validFields.add(col));
        }

        // Add row order fields as valid
        for (const tableDef of template.tableDefinitions) {
            const orderFieldName = tableDef.name === 'main' ? 'RowOrder' : `${tableDef.name.charAt(0).toUpperCase() + tableDef.name.slice(1)}RowOrder`;
            validFields.add(orderFieldName);
        }

        const extraFields = Object.keys(note).filter(
            (field) => !validFields.has(field),
        );
        if (extraFields.length > 0) {
            errors.push(`Unrecognized fields: ${extraFields.join(", ")}.`);
        }

        // Validate field group consistency (semicolon-separated lists)
        for (const fieldGroup of template.fieldGroups) {
            const firstField = fieldGroup[0]!;
            const expectedLength = (note[firstField] || "").split(";").length;

            for (const field of fieldGroup) {
                const actualLength = (note[field] || "").split(";").length;
                if (actualLength !== expectedLength) {
                    errors.push(
                        `Table data inconsistency: Column ${field} has ${actualLength} rows but ${firstField} has ${expectedLength} rows. All columns in a table must have the same number of rows.`,
                    );
                }
            }

            // Validate that row order field has the same length
            const tableDef = template.tableDefinitions.find(table =>
                table.columns.every(col => fieldGroup.includes(col))
            );
            if (tableDef) {
                const orderFieldName = tableDef.name === 'main' ? 'RowOrder' : `${tableDef.name.charAt(0).toUpperCase() + tableDef.name.slice(1)}RowOrder`;
                if (note[orderFieldName]) {
                    const rowOrderLength = note[orderFieldName].split(";").length;
                    if (rowOrderLength !== expectedLength) {
                        errors.push(
                            `Table structure error: Row order has ${rowOrderLength} entries but table data has ${expectedLength} rows.`,
                        );
                    }
                }
            }
        }
    }
    if (errors.length > 0) {
        return { isValid: false, error: errors.join(" ") };
    }
    return { isValid: true };
}
