import * as fsPromises from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Anki } from "../lib/ankiConnect";
import templates from "../lib/cardModel/noteTemplates";

// Create __dirname equivalent for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type CardModel = {
	Back: string;
	Front: string;
};
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

export const updateCardModels = async () => {
	const ankiTemplates = await getAnkiNotes();

	const jsCode = await fsPromises.readFile(
		path.join(__dirname, "../lib/cardModel/card.js"),
		"utf-8",
	);
	const cssCode = await fsPromises.readFile(
		path.join(__dirname, "../lib/cardModel/card.css"),
		"utf-8",
	);

	for (const [modelName, ankiNote] of Object.entries(ankiTemplates)) {
		const template = Object.values(templates).find(
			(template) => template.noteType === modelName,
		);

		if (template) {
			const localStyling = fixString(cssCode);
			if (localStyling !== fixString(ankiNote.styling)) {
				console.log(`Updating ${modelName} styling`);
				await Anki.updateModelStyling(modelName, localStyling);
			} else {
				console.log(`${modelName} styling up-to-date`);
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
				console.log(`Updating ${modelName} cards`);
				await Anki.updateModelTemplates(modelName, updates);
			} else {
				console.log(`${modelName} cards up-to-date`);
			}
		} else {
			console.log(`${modelName} not in local templates`);
		}
	}
	await Anki.sync();
	console.log("done");
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	updateCardModels();
}
