import fs from 'node:fs/promises';
import path from 'node:path';
import yaml from 'yaml';
import { env } from '~/lib/env';

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
    fieldDescriptions: Record<string, string>;
    fieldGroups: string[][];
    fieldLangs: Record<string, string>;
    requiredFields: string[];
    cardDescriptions: Record<string, string>;
    cards: Record<string, CardTemplate>;
};

export type ProcessedNoteTemplate = Omit<NoteTemplate, 'cards'> & {
    cards: Record<string, CardModel>;
};

export type Templates = Record<string, ProcessedNoteTemplate>;

const escapeHTMLAttribute = (str: string) =>
    str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");

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

            templates[language] = {
                ...template,
                cards: cardModels,
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
        const missingFields = template.requiredFields.filter(
            (field) => !note[field],
        );
        if (missingFields.length > 0) {
            errors.push(`Missing required fields: ${missingFields.join(", ")}.`);
        }
        const extraFields = Object.keys(note).filter(
            (field) => !Object.hasOwn(template.fieldDescriptions, field),
        );
        if (extraFields.length > 0) {
            errors.push(`Unrecognized fields: ${extraFields.join(", ")}.`);
        }
        for (const fieldGroup of template.fieldGroups) {
            const expectedLength = (note[fieldGroup[0]!] || "").split(";").length;
            for (const field of fieldGroup) {
                const length = (note[field] || "").split(";").length;
                if (length !== expectedLength) {
                    errors.push(
                        `Inconsistent length between semicolon-separated lists ${fieldGroup[0]} and ${field}.`,
                    );
                }
            }
        }
    }
    if (errors.length > 0) {
        return { isValid: false, error: errors.join(" ") };
    }
    return { isValid: true };
}
