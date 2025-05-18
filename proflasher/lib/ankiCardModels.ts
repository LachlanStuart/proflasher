import * as fsPromises from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Anki } from "./ankiConnect";
import { loadTemplates, type CardModel, type Templates } from "./cardModel/noteTemplates";
import { env } from "./env";

// Create __dirname equivalent for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface NoteModel {
    cards: Record<string, CardModel>;
    styling: string;
}
type Notes = Record<string, NoteModel>;

const getAnkiNoteModel = async (modelName: string) =>
    [
        modelName,
        {
            cards: await Anki.modelTemplates(modelName),
            styling: (await Anki.modelStyling(modelName)).css,
        },
    ] as const;
const getAnkiNotes = async (): Promise<Notes> =>
    Object.fromEntries(
        await Promise.all((await Anki.modelNames()).map(getAnkiNoteModel)),
    );

const fixString = (s: string) =>
    s
        .split("\n")
        .map((line) => line.trim())
        .join("\n")
        .trim();

export const updateCardModels = async (language?: string): Promise<string[]> => {
    const logs: string[] = [];
    const log = (message: string) => {
        console.log(message);
        logs.push(message);
    };

    const ankiTemplates = await getAnkiNotes();
    const templates = await loadTemplates();

    const jsCode = await fsPromises.readFile(
        path.join(__dirname, "../lib/cardModel/card.js"),
        "utf-8",
    );
    const cssCode = await fsPromises.readFile(
        path.join(__dirname, "../lib/cardModel/card.css"),
        "utf-8",
    );

    const templatesToUpdate = language
        ? Object.entries(templates).filter(([_, template]) => template.noteType.startsWith(language.toUpperCase()))
        : Object.entries(templates);

    for (const [lang, template] of templatesToUpdate) {
        const modelName = template.noteType;
        const ankiNote = ankiTemplates[modelName];

        if (ankiNote) {
            // Read language-specific CSS if it exists
            let customCss = "";
            try {
                customCss = await fsPromises.readFile(path.join(env.DATA_REPO_PATH, lang, "style.css"), "utf-8");
                log(`Loaded custom CSS for ${lang}`);
            } catch (error) {
                log(`No custom CSS found for ${lang}`);
            }

            // Combine base CSS with language-specific CSS
            const combinedCss = `${cssCode}\n\n/* Language-specific styles for ${lang} */\n${customCss}`;
            const localStyling = fixString(combinedCss);

            if (localStyling !== fixString(ankiNote.styling)) {
                log(`Updating ${modelName} styling`);
                await Anki.updateModelStyling(modelName, localStyling);
            } else {
                log(`${modelName} styling up-to-date`);
            }

            const updates: Record<string, CardModel> = {};
            let hasChanges = false;
            for (const [cardName, localSides] of Object.entries(template.cards)) {
                const ankiSides = ankiNote.cards[cardName]!;
                const Front = fixString(
                    `${localSides.Front}\n<script>${jsCode}\nrunFront()</script>`,
                );
                const Back = fixString(
                    `${localSides.Back}\n<script>${jsCode}\nrunBack()</script>`,
                );
                updates[cardName] = { Front, Back };
                hasChanges ||=
                    Front !== fixString(ankiSides.Front) ||
                    Back !== fixString(ankiSides.Back);
            }
            if (hasChanges) {
                log(`Updating ${modelName} cards`);
                await Anki.updateModelTemplates(modelName, updates);
            } else {
                log(`${modelName} cards up-to-date`);
            }
        } else {
            log(`${modelName} not found in Anki`);
        }
    }
    await Anki.sync();
    log("Sync complete");
    return logs;
};
