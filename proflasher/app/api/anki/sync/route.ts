import { type NextRequest, NextResponse } from "next/server";
import {
	addMissingCards,
	addMissingDecks,
	addMissingFields,
	createMissingModels,
	updateCardModels,
} from "~/lib/ankiCardModels";
import { Anki } from "~/lib/ankiConnect";

export interface SyncOptions {
	updateCardModels: boolean;
	addNoteTypes: boolean;
	addDecks: boolean;
	addCardTypes: boolean;
	addFields: boolean;
	syncToCloud: boolean;
}

export async function POST(request: NextRequest) {
	try {
		const { language, options }: { language?: string; options: SyncOptions } =
			await request.json();

		if (!options || typeof options !== "object") {
			return NextResponse.json(
				{ success: false, error: "Sync options are required" },
				{ status: 400 },
			);
		}

		const logs: string[] = [];
		const log = (message: string) => {
			console.log(message);
			logs.push(message);
		};

		let overallSuccess = true;

		log(
			`Starting Anki sync for ${language ? language.toUpperCase() : "all languages"}`,
		);
		log(
			`Selected options: ${Object.entries(options)
				.filter(([_, enabled]) => enabled)
				.map(([key]) => key)
				.join(", ")}`,
		);
		log("─".repeat(50));

		// Add missing note types (if selected)
		if (options.addNoteTypes) {
			log("\n🔧 Creating missing note types...");
			const success = await createMissingModels(language, log);
			overallSuccess = overallSuccess && success;
		}

		// Add missing decks (if selected)
		if (options.addDecks) {
			log("\n🗂️ Checking missing decks...");
			const success = await addMissingDecks(language, log);
			overallSuccess = overallSuccess && success;
		}

		// Add missing card types (if selected)
		if (options.addCardTypes) {
			log("\n📋 Checking missing card types...");
			const success = await addMissingCards(language, log);
			overallSuccess = overallSuccess && success;
		}

		// Add missing fields (if selected)
		if (options.addFields) {
			log("\n🏷️ Adding missing fields...");
			const success = await addMissingFields(language, log);
			overallSuccess = overallSuccess && success;
		}

		// Update card models (if selected)
		if (options.updateCardModels) {
			log("\n🎨 Updating card models...");
			const success = await updateCardModels(language, log);
			overallSuccess = overallSuccess && success;
		}

		// Sync to cloud (if selected)
		if (options.syncToCloud) {
			log("\n☁️ Syncing to cloud...");
			try {
				await Anki.sync();
				log("✅ Cloud sync complete");
			} catch (error) {
				overallSuccess = false;
				log(
					`❌ Cloud sync failed: ${error instanceof Error ? error.message : String(error)}`,
				);
			}
		}

		if (overallSuccess) {
			log("\n✅ All operations completed successfully!");
		} else {
			log(
				"\n⚠️ Some operations completed with errors - please review the logs above",
			);
		}

		return NextResponse.json({ success: overallSuccess, logs });
	} catch (error) {
		console.error("Error during Anki sync:", error);
		return NextResponse.json(
			{
				success: false,
				error: error instanceof Error ? error.message : String(error),
			},
			{ status: 500 },
		);
	}
}
