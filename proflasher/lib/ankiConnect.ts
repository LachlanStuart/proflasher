// Docs: https://github.com/FooSoft/anki-connect

import { Mutex } from "async-mutex";

const mutex = new Mutex();
const callAnkiConnect = async (action: string, params = {}) => {
    console.log("Calling AnkiConnect", action, params);
    try {
        let response: any;
        const release = await mutex.acquire();
        try {
            response = await fetch("http://127.0.0.1:8765", {
                method: "post",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action, version: 6, params }),
            });
            if (response.status !== 200) {
                throw new Error(
                    `AnkiConnect unexpected status: ${response.status} ${response.statusText}`,
                );
            }
        } finally {
            release();
        }

        const result = await response.json();
        if (
            Object.getOwnPropertyNames(result).length !== 2 ||
            !Object.hasOwn(result, "error") ||
            !Object.hasOwn(result, "result")
        ) {
            throw new Error(`AnkiConnect malformed response: "${result}"`);
        }
        if (result.error) {
            throw new Error(`AnkiConnect error: ${result.error}`);
        }
        return result.result;
    } catch (err) {
        console.error("Error calling AnkiConnect", action, params, err);
        throw err;
    }
};

export type ModelTemplate = {
    Front: string;
    Back: string;
};
export type ModelStyling = {
    css: string;
};
export type CardInfo = {
    answer: string;
    question: string;
    deckName: string;
    modelName: string;
    fieldOrder: number;
    fields: Record<string, { value: string; order: number }>;
    css: string;
    cardId: number;
    interval: number;
    note: number;
    ord: number;
    type: number;
    due: number;
    reps: number;
    lapses: number;
    left: number;
    mod: number;
};
export interface AddNote {
    deckName: string;
    modelName: string;
    fields: Record<string, string>;
    options?: {
        allowDuplicate?: boolean;
        duplicateScope?: "deck" | "everywhere";
        duplicateScopeOptions?: {
            deckName?: string;
            checkChildren?: boolean;
            checkAllModels: boolean;
        };
    };
    tags?: string[];
    audio?: any[];
    video?: any[];
    picture?: any[];
}

export type NoteInfo = {
    noteId: number;
    modelName: string;
    tags: string[];
    fields: Record<string, { value: string; order: number }>;
};

export const Anki = {
    // Card
    getEaseFactors: (cards: number[]): Promise<number[]> =>
        callAnkiConnect("getEaseFactors", { cards }),
    setEaseFactors: (cards: number[], easeFactors: number[]): Promise<number[]> =>
        callAnkiConnect("setEaseFactors", { cards, easeFactors }),
    setSpecificValueOfCard: (
        card: number,
        keys: string[],
        newValues: string[],
    ): Promise<boolean[]> =>
        callAnkiConnect("setSpecificValueOfCard", { card, keys, newValues }),
    suspend: (cards: number[]): Promise<boolean> =>
        callAnkiConnect("suspend", { cards }),
    unsuspend: (cards: number[]): Promise<boolean> =>
        callAnkiConnect("unsuspend", { cards }),
    areSuspended: (cards: number[]): Promise<(boolean | null)[]> =>
        callAnkiConnect("areSuspended", { cards }),
    areDue: (cards: number[]): Promise<(boolean | null)[]> =>
        callAnkiConnect("areDue", { cards }),
    getIntervals: (cards: number[]): Promise<number[]> =>
        callAnkiConnect("getIntervals", { cards }),
    findCards: (query: string): Promise<number[]> =>
        callAnkiConnect("findCards", { query }),
    cardsModTime: (cards: number[]): Promise<number[]> =>
        callAnkiConnect("cardsModTime", { cards }),
    cardsInfo: (cards: number[]): Promise<CardInfo[]> =>
        callAnkiConnect("cardsInfo", { cards }),
    forgetCards: (cards: number[]): Promise<null> =>
        callAnkiConnect("forgetCards", { cards }),
    relearnCards: (cards: number[]): Promise<null> =>
        callAnkiConnect("relearnCards", { cards }),

    // Deck
    deckNames: (): Promise<string[]> => callAnkiConnect("deckNames"),
    deckNamesAndIds: (): Promise<Record<string, number>> =>
        callAnkiConnect("deckNamesAndIds"),
    getDecks: (cards: number[]): Promise<Record<string, number[]>> =>
        callAnkiConnect("getDecks", { cards }),
    createDeck: (deck: string): Promise<number> =>
        callAnkiConnect("createDeck", { deck }),

    // Model
    modelNames: (): Promise<string[]> => callAnkiConnect("modelNames"),
    modelNamesAndIds: (): Promise<Record<string, number>> =>
        callAnkiConnect("modelNamesAndIds"),
    modelFieldNames: (modelName: string): Promise<string[]> =>
        callAnkiConnect("modelFieldNames", { modelName }),
    modelTemplates: (modelName: string): Promise<Record<string, ModelTemplate>> =>
        callAnkiConnect("modelTemplates", { modelName }),
    modelStyling: (modelName: string): Promise<ModelStyling> =>
        callAnkiConnect("modelStyling", { modelName }),
    updateModelTemplates: (
        name: string,
        templates: Record<string, ModelTemplate>,
    ): Promise<null> =>
        callAnkiConnect("updateModelTemplates", { model: { name, templates } }),
    updateModelStyling: (name: string, css: string): Promise<null> =>
        callAnkiConnect("updateModelStyling", { model: { name, css } }),
    modelFieldAdd: (modelName: string, fieldName: string, index?: number): Promise<null> =>
        callAnkiConnect("modelFieldAdd", { modelName, fieldName, index }),
    modelTemplateAdd: (modelName: string, template: { Name: string; Front: string; Back: string }): Promise<null> =>
        callAnkiConnect("modelTemplateAdd", { modelName, template }),
    createModel: (modelName: string, inOrderFields: string[], cardTemplates: any[], css?: string): Promise<null> =>
        callAnkiConnect("createModel", {
            modelName,
            inOrderFields,
            cardTemplates,
            css: css || ""
        }),
    modelFieldsOnTemplates: (modelName: string): Promise<Record<string, [string[], string[]]>> =>
        callAnkiConnect("modelFieldsOnTemplates", { modelName }),
    findModelsInCollection: (modelNames: string[]): Promise<string[]> =>
        callAnkiConnect("findModelsInCollection", { modelNames }),

    // Note
    addNote: (note: AddNote): Promise<number | null> =>
        callAnkiConnect("addNote", { note }),
    addNotes: (notes: AddNote[]): Promise<(number | null)[]> =>
        callAnkiConnect("addNotes", { notes }),
    canAddNotes: (notes: AddNote[]): Promise<boolean[]> =>
        callAnkiConnect("canAddNotes", { notes }),
    updateNoteFields: (
        id: number,
        fields: Record<string, string>,
    ): Promise<null> =>
        callAnkiConnect("updateNoteFields", { note: { id, fields } }),
    guiSelectCard: (cardId: number): Promise<boolean> =>
        callAnkiConnect("guiSelectCard", { card: cardId }),
    addTags: (notes: number[], tags: string): Promise<null> =>
        callAnkiConnect("addTags", { notes, tags }),
    removeTags: (notes: number[], tags: string): Promise<null> =>
        callAnkiConnect("removeTags", { notes, tags }),
    getTags: (): Promise<string[]> => callAnkiConnect("getTags"),
    findNotes: (query: string): Promise<number[]> =>
        callAnkiConnect("findNotes", { query }),
    notesInfo: (notes: number[]): Promise<NoteInfo[]> =>
        callAnkiConnect("notesInfo", { notes }),
    deleteNotes: (notes: number[]): Promise<null> =>
        callAnkiConnect("notesInfo", { notes }),

    // Misc
    sync: (): Promise<null> => callAnkiConnect("sync"),
};
