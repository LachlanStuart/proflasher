import * as fsPromises from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Anki } from "./ankiConnect";
import {
	type CardModel,
	type Templates,
	loadTemplates,
} from "./cardModel/noteTemplates";
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

export const updateCardModels = async (
	language?: string,
	log: (message: string) => void = console.log,
): Promise<boolean> => {
	let success = true;

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
		? Object.entries(templates).filter(([_, template]) =>
				template.noteType.startsWith(language.toUpperCase()),
			)
		: Object.entries(templates);

	for (const [lang, template] of templatesToUpdate) {
		const modelName = template.noteType;
		const ankiNote = ankiTemplates[modelName];

		if (ankiNote) {
			// Read language-specific CSS if it exists
			let customCss = "";
			try {
				customCss = await fsPromises.readFile(
					path.join(env.DATA_REPO_PATH, lang, "style.css"),
					"utf-8",
				);
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
			success = false;
		}
	}

	return success;
};

export const addMissingFields = async (
	language?: string,
	log: (message: string) => void = console.log,
): Promise<boolean> => {
	let success = true;

	const templates = await loadTemplates();
	const languageTemplates = language
		? Object.entries(templates).filter(([_, template]) =>
				template.noteType.startsWith(language.toUpperCase()),
			)
		: Object.entries(templates);

	if (languageTemplates.length === 0) {
		log(`No templates found for language: ${language || "all languages"}`);
		success = false;
		return success;
	}

	for (const [lang, template] of languageTemplates) {
		const modelName = template.noteType;
		log(`Checking model: ${modelName}`);

		try {
			// Get existing model field names
			const existingFields = await Anki.modelFieldNames(modelName);
			log(`Existing fields in ${modelName}: ${existingFields.join(", ")}`);

			// Get all fields that should exist (including table columns and RowOrder fields)
			const requiredFields = new Set<string>();

			// Add all fields from fieldDescriptions
			Object.keys(template.fieldDescriptions).forEach((field) =>
				requiredFields.add(field),
			);

			// Add table columns from tableDefinitions
			for (const tableDef of template.tableDefinitions) {
				tableDef.columns.forEach((col) => requiredFields.add(col));
			}

			// Add RowOrder fields for each table
			for (const tableDef of template.tableDefinitions) {
				const orderFieldName =
					tableDef.name === "main"
						? "RowOrder"
						: `${tableDef.name.charAt(0).toUpperCase() + tableDef.name.slice(1)}RowOrder`;
				requiredFields.add(orderFieldName);
			}

			log(
				`Required fields for ${modelName}: ${Array.from(requiredFields).join(", ")}`,
			);

			// Find missing fields
			const missingFields = Array.from(requiredFields).filter(
				(field) => !existingFields.includes(field),
			);

			// Check for extra fields (alert user but don't remove)
			const extraFields = existingFields.filter(
				(field) => !requiredFields.has(field),
			);
			if (extraFields.length > 0) {
				log(`ℹ️  Extra fields in ${modelName}: ${extraFields.join(", ")}`);
				log(
					"   These are not defined in your template - please review manually",
				);
			}

			if (missingFields.length === 0) {
				log(`✅ All required fields exist in ${modelName}`);
			} else {
				log(
					`➕ Adding missing fields to ${modelName}: ${missingFields.join(", ")}`,
				);

				// Add each missing field
				for (const fieldName of missingFields) {
					try {
						await Anki.modelFieldAdd(modelName, fieldName);
						log(`   ✅ Added field: ${fieldName}`);
					} catch (error) {
						success = false;
						log(
							`   ❌ Failed to add field ${fieldName}: ${error instanceof Error ? error.message : String(error)}`,
						);
					}
				}
			}
		} catch (error) {
			if (
				error instanceof Error &&
				error.message.includes("model was not found")
			) {
				log(`❌ Model ${modelName} not found in Anki`);
				success = false;
			} else {
				success = false;
				log(
					`❌ Error checking fields for ${modelName}: ${error instanceof Error ? error.message : String(error)}`,
				);
			}
		}
	}

	return success;
};

export const addMissingCards = async (
	language?: string,
	log: (message: string) => void = console.log,
): Promise<boolean> => {
	let success = true;

	const templates = await loadTemplates();
	const languageTemplates = language
		? Object.entries(templates).filter(([_, template]) =>
				template.noteType.startsWith(language.toUpperCase()),
			)
		: Object.entries(templates);

	if (languageTemplates.length === 0) {
		log(`No templates found for language: ${language || "all languages"}`);
		success = false;
		return success;
	}

	// Load JS code for card templates
	const jsCode = await fsPromises.readFile(
		path.join(__dirname, "../lib/cardModel/card.js"),
		"utf-8",
	);

	for (const [lang, template] of languageTemplates) {
		const modelName = template.noteType;
		log(`Checking card types for model: ${modelName}`);

		try {
			// Get existing card templates
			const existingCards = await Anki.modelTemplates(modelName);
			const existingCardNames = Object.keys(existingCards);
			log(
				`Existing card types in ${modelName}: ${existingCardNames.join(", ")}`,
			);

			// Get required card types
			const requiredCardNames = Object.keys(template.cards);
			log(
				`Required card types for ${modelName}: ${requiredCardNames.join(", ")}`,
			);

			// Find missing card types
			const missingCards = requiredCardNames.filter(
				(cardName) => !existingCardNames.includes(cardName),
			);

			// Check for extra card types (alert user but don't remove)
			const extraCards = existingCardNames.filter(
				(cardName) => !requiredCardNames.includes(cardName),
			);
			if (extraCards.length > 0) {
				log(`ℹ️  Extra card types in ${modelName}: ${extraCards.join(", ")}`);
				log(
					"   These are not defined in your template - please review manually",
				);
			}

			if (missingCards.length === 0) {
				log(`✅ All required card types exist in ${modelName}`);
			} else {
				log(
					`➕ Adding missing card types to ${modelName}: ${missingCards.join(", ")}`,
				);

				// Add each missing card template
				for (const cardName of missingCards) {
					try {
						const cardModel = template.cards[cardName]!;
						const cardTemplate = {
							Name: cardName,
							Front: fixString(
								`${cardModel.Front}\n<script>${jsCode}\nrunFront()</script>`,
							),
							Back: fixString(
								`${cardModel.Back}\n<script>${jsCode}\nrunBack()</script>`,
							),
						};

						await Anki.modelTemplateAdd(modelName, cardTemplate);
						log(`   ✅ Added card type: ${cardName}`);
					} catch (error) {
						success = false;
						log(
							`   ❌ Failed to add card type ${cardName}: ${error instanceof Error ? error.message : String(error)}`,
						);
					}
				}
			}
		} catch (error) {
			if (
				error instanceof Error &&
				error.message.includes("model was not found")
			) {
				log(`❌ Model ${modelName} not found in Anki`);
				success = false;
			} else {
				success = false;
				log(
					`❌ Error checking card types for ${modelName}: ${error instanceof Error ? error.message : String(error)}`,
				);
			}
		}
	}

	return success;
};

export const createMissingModels = async (
	language?: string,
	log: (message: string) => void = console.log,
): Promise<boolean> => {
	let success = true;

	const templates = await loadTemplates();
	const languageTemplates = language
		? Object.entries(templates).filter(([_, template]) =>
				template.noteType.startsWith(language.toUpperCase()),
			)
		: Object.entries(templates);

	if (languageTemplates.length === 0) {
		log(`No templates found for language: ${language || "all languages"}`);
		success = false;
		return success;
	}

	// Get all existing model names
	const existingModels = await Anki.modelNames();

	for (const [lang, template] of languageTemplates) {
		const modelName = template.noteType;

		if (existingModels.includes(modelName)) {
			log(`✅ Model ${modelName} already exists`);
			continue;
		}

		log(`➕ Creating missing model: ${modelName}`);

		try {
			// Build field list
			const fields = new Set<string>();

			// Add all fields from fieldDescriptions
			Object.keys(template.fieldDescriptions).forEach((field) =>
				fields.add(field),
			);

			// Add table columns from tableDefinitions
			for (const tableDef of template.tableDefinitions) {
				tableDef.columns.forEach((col) => fields.add(col));
			}

			// Add RowOrder fields for each table
			for (const tableDef of template.tableDefinitions) {
				const orderFieldName =
					tableDef.name === "main"
						? "RowOrder"
						: `${tableDef.name.charAt(0).toUpperCase() + tableDef.name.slice(1)}RowOrder`;
				fields.add(orderFieldName);
			}

			const fieldList = Array.from(fields);
			log(`   Fields for ${modelName}: ${fieldList.join(", ")}`);

			// Build card templates with JS
			const jsCode = await fsPromises.readFile(
				path.join(__dirname, "../lib/cardModel/card.js"),
				"utf-8",
			);

			const cardTemplates = Object.entries(template.cards).map(
				([cardName, cardModel]) => ({
					Name: cardName,
					Front: fixString(
						`${cardModel.Front}\n<script>${jsCode}\nrunFront()</script>`,
					),
					Back: fixString(
						`${cardModel.Back}\n<script>${jsCode}\nrunBack()</script>`,
					),
				}),
			);

			log(
				`   Card types for ${modelName}: ${cardTemplates.map((t) => t.Name).join(", ")}`,
			);

			// Load CSS
			let css = "";
			try {
				// Load base CSS
				const baseCss = await fsPromises.readFile(
					path.join(__dirname, "../lib/cardModel/card.css"),
					"utf-8",
				);

				// Load language-specific CSS if it exists
				let customCss = "";
				try {
					customCss = await fsPromises.readFile(
						path.join(env.DATA_REPO_PATH, lang, "style.css"),
						"utf-8",
					);
					log(`   Loaded custom CSS for ${lang}`);
				} catch (error) {
					log(`   No custom CSS found for ${lang}`);
				}

				css = fixString(
					`${baseCss}\n\n/* Language-specific styles for ${lang} */\n${customCss}`,
				);
			} catch (error) {
				log(
					`   Warning: Could not load CSS files: ${error instanceof Error ? error.message : String(error)}`,
				);
			}

			// Create the model
			await Anki.createModel(modelName, fieldList, cardTemplates, css);
			log(`   ✅ Successfully created model: ${modelName}`);
		} catch (error) {
			success = false;
			log(
				`   ❌ Error creating model ${modelName}: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	return success;
};

export const addMissingDecks = async (
	language?: string,
	log: (message: string) => void = console.log,
): Promise<boolean> => {
	let success = true;

	const templates = await loadTemplates();
	const languageTemplates = language
		? Object.entries(templates).filter(([_, template]) =>
				template.noteType.startsWith(language.toUpperCase()),
			)
		: Object.entries(templates);

	if (languageTemplates.length === 0) {
		log(`No templates found for language: ${language || "all languages"}`);
		success = false;
		return success;
	}

	// Get existing decks
	const existingDecks = await Anki.deckNamesAndIds();
	const existingDeckNames = Object.keys(existingDecks);
	log(`Existing decks: ${existingDeckNames.join(", ")}`);

	// Get required decks from templates
	const requiredDecks = new Set<string>();

	for (const [lang, template] of languageTemplates) {
		// Use the deck name from the template
		if (template.deckName) {
			requiredDecks.add(template.deckName);
			log(`Required deck for ${template.noteType}: ${template.deckName}`);
		} else {
			log(`⚠️  No deckName specified in template for ${template.noteType}`);
		}
	}

	if (requiredDecks.size === 0) {
		log("No deck names found in templates");
		success = false;
		return success;
	}

	log(`All required decks: ${Array.from(requiredDecks).join(", ")}`);

	// Find missing decks
	const missingDecks = Array.from(requiredDecks).filter(
		(deck) => !existingDeckNames.includes(deck),
	);

	// Check for extra language-related decks (informational only)
	const languagePattern = language
		? new RegExp(`.*${language.toUpperCase()}.*`, "i")
		: /Lang::|JP|FR|DE|ZH/i;
	const extraDecks = existingDeckNames.filter(
		(deck) => languagePattern.test(deck) && !requiredDecks.has(deck),
	);

	if (extraDecks.length > 0) {
		log(`ℹ️  Extra language-related decks found: ${extraDecks.join(", ")}`);
		log("   These might be custom decks - please review manually");
	}

	if (missingDecks.length === 0) {
		log("✅ All required decks exist");
	} else {
		log(`➕ Creating missing decks: ${missingDecks.join(", ")}`);

		// Create each missing deck
		for (const deckName of missingDecks) {
			try {
				const deckId = await Anki.createDeck(deckName);
				log(`   ✅ Created deck: ${deckName} (ID: ${deckId})`);
			} catch (error) {
				success = false;
				log(
					`   ❌ Failed to create deck ${deckName}: ${error instanceof Error ? error.message : String(error)}`,
				);
			}
		}

		if (missingDecks.length > 0) {
			log("");
			log(
				"📋 REMINDER: Please check the scheduling options for newly created decks!",
			);
			log(
				"   Go to Tools > Manage Note Types > [Deck] > Options to configure:",
			);
			log("   - Daily limits, learning steps, graduation intervals, etc.");
		}
	}

	return success;
};
