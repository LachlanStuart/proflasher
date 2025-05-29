import { type NextRequest, NextResponse } from "next/server";
import { updateCardModels, addMissingFields, addMissingCards, createMissingModels, addMissingDecks } from "~/lib/ankiCardModels";
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
        const { language, options }: { language?: string; options: SyncOptions } = await request.json();

        if (!options || typeof options !== 'object') {
            return NextResponse.json(
                { success: false, error: "Sync options are required" },
                { status: 400 }
            );
        }

        const logs: string[] = [];
        const log = (message: string) => {
            console.log(message);
            logs.push(message);
        };

        log(`Starting Anki sync for ${language ? language.toUpperCase() : 'all languages'}`);
        log(`Selected options: ${Object.entries(options).filter(([_, enabled]) => enabled).map(([key]) => key).join(', ')}`);
        log('─'.repeat(50));

        // Add missing note types (if selected)
        if (options.addNoteTypes) {
            log('\n🔧 Creating missing note types...');
            const noteTypeLogs = await createMissingModels(language);
            logs.push(...noteTypeLogs);
        }

        // Add missing decks (if selected)
        if (options.addDecks) {
            log('\n🗂️ Checking missing decks...');
            const deckLogs = await addMissingDecks(language);
            logs.push(...deckLogs);
        }

        // Add missing card types (if selected)
        if (options.addCardTypes) {
            log('\n📋 Checking missing card types...');
            const cardTypeLogs = await addMissingCards(language);
            logs.push(...cardTypeLogs);
        }

        // Add missing fields (if selected)
        if (options.addFields) {
            log('\n🏷️ Adding missing fields...');
            const fieldLogs = await addMissingFields(language);
            logs.push(...fieldLogs);
        }

        // Update card models (if selected)
        if (options.updateCardModels) {
            log('\n🎨 Updating card models...');
            const updateLogs = await updateCardModels(language);
            logs.push(...updateLogs);
        }

        // Sync to cloud (if selected)
        if (options.syncToCloud) {
            log('\n☁️ Syncing to cloud...');
            try {
                await Anki.sync();
                log('✅ Cloud sync complete');
            } catch (error) {
                log(`❌ Cloud sync failed: ${error instanceof Error ? error.message : String(error)}`);
            }
        }

        log('\n✅ All operations complete!');

        return NextResponse.json({ success: true, logs });
    } catch (error) {
        console.error("Error during Anki sync:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            },
            { status: 500 }
        );
    }
}
