import fs from "node:fs/promises";
import path from "node:path";
import yaml from "yaml";
import { env } from "~/lib/env";
import type { TableDefinition } from "./tableCard";

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
    tableDefinitions: TableDefinition[];
};

export type ProcessedNoteTemplate = Omit<NoteTemplate, "cards"> & {
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
        r.push("{{#UsageNotes}}<div>{{UsageNotes}}</div>{{/UsageNotes}}");
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

export async function loadTemplates(): Promise<Templates> {
    const templates: Templates = {};
    const entries = await fs.readdir(env.DATA_REPO_PATH, { withFileTypes: true });

    for (const entry of entries) {
        if (!entry.isDirectory() || entry.name === ".git") continue;

        const language = entry.name;
        const notePath = path.join(env.DATA_REPO_PATH, language, "note.yaml");

        try {
            const noteContent = await fs.readFile(notePath, "utf-8");
            const template = yaml.parse(noteContent) as NoteTemplate;

            // Convert the YAML card templates into Anki card models
            const cardModels = cards(template);

            // Filter out RowOrder fields from fieldDescriptions since they're auto-generated
            const filteredFieldDescriptions = { ...template.fieldDescriptions };
            for (const tableDef of template.tableDefinitions) {
                const orderFieldName =
                    tableDef.name === "main"
                        ? "RowOrder"
                        : `${tableDef.name.charAt(0).toUpperCase() + tableDef.name.slice(1)}RowOrder`;
                delete filteredFieldDescriptions[orderFieldName];
            }

            templates[language] = {
                ...template,
                fieldDescriptions: filteredFieldDescriptions,
                cards: cardModels,
            };
        } catch (error) {
            console.error(`Failed to load template for ${language}:`, error);
        }
    }

    return templates;
}

export async function validateNote(
    noteType: string,
    note: Record<string, string>,
    templates: Templates,
): Promise<{ isValid: boolean; error?: string }> {
    const errors = [];

    const template = Object.values(templates).find((t) => t.noteType === noteType);
    if (!template) {
        errors.push(`Note type "${noteType}" not found.`);
    } else {
        // Separate required fields into table columns and non-table fields for clearer error messages
        const tableColumns = new Set<string>();
        const rowOrderFields = new Set<string>();

        for (const tableDef of template.tableDefinitions) {
            tableDef.columns.forEach((col) => tableColumns.add(col));
            const orderFieldName =
                tableDef.name === "main"
                    ? "RowOrder"
                    : `${tableDef.name.charAt(0).toUpperCase() + tableDef.name.slice(1)}RowOrder`;
            rowOrderFields.add(orderFieldName);
        }

        // Check for missing required fields, but be more specific about the type
        const missingTableFields = template.requiredFields.filter((field) => !note[field] && tableColumns.has(field));
        const missingNonTableFields = template.requiredFields.filter(
            (field) => !note[field] && !tableColumns.has(field),
        );

        if (missingNonTableFields.length > 0) {
            errors.push(`Missing required non-table fields: ${missingNonTableFields.join(", ")}.`);
        }
        if (missingTableFields.length > 0) {
            errors.push(
                `Missing required table data for columns: ${missingTableFields.join(", ")}. Make sure your tables contain data for these columns.`,
            );
        }

        // Get all valid fields (existing fields + table columns + row order fields)
        const validFields = new Set(Object.keys(template.fieldDescriptions));

        // Add table columns as valid fields
        for (const tableDef of template.tableDefinitions) {
            tableDef.columns.forEach((col) => validFields.add(col));
        }

        // Add row order fields as valid
        for (const tableDef of template.tableDefinitions) {
            const orderFieldName =
                tableDef.name === "main"
                    ? "RowOrder"
                    : `${tableDef.name.charAt(0).toUpperCase() + tableDef.name.slice(1)}RowOrder`;
            validFields.add(orderFieldName);
        }

        const extraFields = Object.keys(note).filter((field) => !validFields.has(field));
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
            const tableDef = template.tableDefinitions.find((table) =>
                table.columns.every((col) => fieldGroup.includes(col)),
            );
            if (tableDef) {
                const orderFieldName =
                    tableDef.name === "main"
                        ? "RowOrder"
                        : `${tableDef.name.charAt(0).toUpperCase() + tableDef.name.slice(1)}RowOrder`;
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
