import { type NextRequest, NextResponse } from "next/server";
import { Anki } from "~/lib/ankiConnect";
import { loadTemplates } from "~/lib/cardModel/noteTemplates";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action, params } = body;

        if (!action) {
            return NextResponse.json(
                { error: "Missing required action parameter" },
                { status: 400 },
            );
        }

        let result: any;

        // Handle different AnkiConnect actions
        if (action === "addNote") {
            const { modelName, fields } = params;

            // Load templates to get deck name
            const templates = await loadTemplates();
            const template = Object.values(templates).find(t => t.noteType === modelName);

            if (!template) {
                return NextResponse.json(
                    { error: `Template not found for model: ${modelName}` },
                    { status: 400 },
                );
            }

            const deckName = template.deckName;
            result = await Anki.addNote({ deckName, modelName, fields });
        } else if (action === "findNotes") {
            result = await Anki.findNotes(params);
        } else if (action === "findCards") {
            result = await Anki.findCards(params);
        } else if (action === "cardsInfo") {
            result = await Anki.cardsInfo(params);
        } else if (action === "notesInfo") {
            result = await Anki.notesInfo(params);
        } else if (action === "updateNoteFields") {
            // Also extract noteType for updateNoteFields
            if (params.fields && params.fields.noteType) {
                const { noteType, ...cleanedFields } = params.fields;
                result = await Anki.updateNoteFields(params.id, cleanedFields);
            } else {
                result = await Anki.updateNoteFields(params.id, params.fields);
            }
        } else if (action === "sync") {
            result = await Anki.sync();
        } else if (action === "guiSelectCard") {
            result = await Anki.guiSelectCard(params.card);
        } else {
            return NextResponse.json(
                { error: `Unsupported AnkiConnect action: ${action}` },
                { status: 400 },
            );
        }

        return NextResponse.json(result);
    } catch (error) {
        console.error("Error in AnkiConnect API:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : String(error) },
            { status: 500 },
        );
    }
}
