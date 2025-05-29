import { type NextRequest, NextResponse } from "next/server";
import { Anki } from "~/lib/ankiConnect";
import { loadTemplates, type Templates } from "~/lib/cardModel/noteTemplates";
import { env } from "~/lib/env";

// Cache templates in memory to avoid reading from disk on every request
let templatesCache: Templates | null = null;
async function getTemplates(): Promise<Templates> {
    if (!templatesCache) {
        templatesCache = await loadTemplates();
    }
    return templatesCache;
}

interface CardOperation {
    modelName: string;
    fields: Record<string, string>;
    activeCardTypes?: string[];
    update?: boolean;
    noteId?: number;
}

export async function POST(request: NextRequest) {
    try {
        const { modelName, fields, activeCardTypes, update, noteId }: CardOperation = await request.json();

        if (!modelName || !fields) {
            return NextResponse.json(
                { error: "Missing required fields: modelName and fields" },
                { status: 400 }
            );
        }

        // Get templates to find the language for the deck name
        const templates = await loadTemplates();
        const template = Object.values(templates).find(t => t.noteType === modelName);
        if (!template) {
            return NextResponse.json(
                { error: `Template not found for model ${modelName}` },
                { status: 400 }
            );
        }

        // Get deck name based on language
        const deckName = `Lang::${template.language.toUpperCase()}`;

        let result: any;
        let cardIds: number[] = [];

        if (update && noteId) {
            // Update existing note
            result = await Anki.updateNoteFields(noteId, fields);
            // Get card IDs for the updated note
            const cards = await Anki.findCards(`nid:${noteId}`);
            cardIds = cards;
        } else {
            try {
                // Add new note
                result = await Anki.addNote({ deckName, modelName, fields });
                // Get card IDs for the new note
                const cards = await Anki.findCards(`nid:${result}`);
                cardIds = cards;
            } catch (error) {
                // Check if it's a duplicate error
                if (error instanceof Error && error.message.includes("duplicate")) {
                    // Search for the existing note using the Key field
                    const existingNotes = await Anki.findNotes(`"Key:${fields.Key}" note:${modelName}`);
                    if (existingNotes.length > 0) {
                        return NextResponse.json({
                            error: "duplicate",
                            noteId: existingNotes[0],
                            fields
                        }, { status: 409 }); // 409 Conflict
                    }
                }
                throw error;
            }
        }

        // Get all cards for the note
        const cardsInfo = await Anki.cardsInfo(cardIds);

        // Get the actual card templates from Anki to determine the correct order
        const ankiTemplates = await Anki.modelTemplates(modelName);
        const cardTypeToOrd = new Map(
            Object.keys(ankiTemplates).map((name, ord) => [name, ord])
        );
        console.log("Card type to ord mapping:", Object.fromEntries(cardTypeToOrd));

        // Handle card suspension based on activeCardTypes
        if (activeCardTypes) {
            console.log("Active card types:", activeCardTypes);

            // Separate cards into those to suspend and unsuspend
            const [cardsToSuspend, cardsToUnsuspend] = cardsInfo.reduce<[number[], number[]]>(
                ([suspend, unsuspend], card) => {
                    // Find the card type name that matches this card's ord
                    const cardTypeName = Array.from(cardTypeToOrd.entries()).find(
                        ([_, ord]) => ord === card.ord
                    )?.[0];
                    console.log(`Card ${card.cardId}: type=${card.type}, ord=${card.ord}, name=${cardTypeName}`);

                    if (!cardTypeName) {
                        return [suspend, unsuspend];
                    }

                    if (activeCardTypes.includes(cardTypeName)) {
                        return [suspend, [...unsuspend, card.cardId]];
                    } else {
                        return [[...suspend, card.cardId], unsuspend];
                    }
                },
                [[], []]
            );

            // Suspend cards not in activeCardTypes
            if (cardsToSuspend.length > 0) {
                console.log("Suspending cards:", cardsToSuspend);
                await Anki.suspend(cardsToSuspend);
            }

            // Unsuspend cards in activeCardTypes
            if (cardsToUnsuspend.length > 0) {
                console.log("Unsuspending cards:", cardsToUnsuspend);
                await Anki.unsuspend(cardsToUnsuspend);
            }
        }

        return NextResponse.json({
            success: true,
            noteId: update ? noteId : result,
            cardIds,
            cardsInfo
        });
    } catch (error) {
        console.error("Error in card operation:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        );
    }
}
