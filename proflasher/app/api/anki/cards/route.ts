import { type NextRequest, NextResponse } from "next/server";
import { Anki } from "~/lib/ankiConnect";
import templates from "~/lib/cardModel/noteTemplates";

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

        // Get deck name based on model
        const deckName = {
            "ZH<->EN": "Lang::ZH",
            "DE<->EN": "Lang::DE",
            "FR<->EN": "Lang::FR",
            "JP<->EN": "Lang::JP",
        }[modelName];

        if (!deckName) {
            return NextResponse.json(
                { error: `Invalid model name: ${modelName}` },
                { status: 400 }
            );
        }

        let result: any;
        let cardIds: number[] = [];

        if (update && noteId) {
            // Update existing note
            result = await Anki.updateNoteFields(noteId, fields);
            // Get card IDs for the updated note
            const cards = await Anki.findCards(`nid:${noteId}`);
            cardIds = cards;
        } else {
            // Add new note
            result = await Anki.addNote({ deckName, modelName, fields });
            // Get card IDs for the new note
            const cards = await Anki.findCards(`nid:${result}`);
            cardIds = cards;
        }

        // Get template to map card type names to indices
        const template = Object.values(templates).find(t => t.noteType === modelName);
        if (!template) {
            throw new Error(`Template not found for model ${modelName}`);
        }

        // Get all cards for the note
        const cardsInfo = await Anki.cardsInfo(cardIds);

        // Get the actual card templates from Anki to determine the correct order
        const ankiTemplates = await Anki.modelTemplates(modelName);
        console.log("Anki templates:", ankiTemplates);
        const cardTypeToOrd = new Map(
            Object.keys(ankiTemplates).map((name, ord) => [name, ord])
        );
        console.log("Card type to ord mapping:", Object.fromEntries(cardTypeToOrd));

        // Suspend cards that aren't in activeCardTypes
        if (activeCardTypes) {
            console.log("Active card types:", activeCardTypes);
            const cardsToSuspend = cardsInfo.filter(card => {
                // Find the card type name that matches this card's ord
                const cardTypeName = Array.from(cardTypeToOrd.entries()).find(
                    ([_, ord]) => ord === card.ord
                )?.[0];
                console.log(`Card ${card.cardId}: type=${card.type}, ord=${card.ord}, name=${cardTypeName}`);
                return !cardTypeName || !activeCardTypes.includes(cardTypeName);
            });

            if (cardsToSuspend.length > 0) {
                console.log("Suspending cards:", cardsToSuspend.map(card => card.cardId));
                await Anki.suspend(cardsToSuspend.map(card => card.cardId));
            } else {
                console.log("No cards to suspend");
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
