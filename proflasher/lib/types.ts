// Simple type definitions for Anki card-related structures
export interface AnkiFieldMapping {
    sourceField: string; // Field name from the LLM output
    ankiField: string; // Target Anki field name
}

// Defines the direct structure for an Anki note type
export interface AnkiNoteTypeConfig {
    modelName: string; // Anki's note type name
    fieldMappings: AnkiFieldMapping[];
    cardStructure: Record<string, string>; // Optional guide for LLM
}

// Streamlined request structure for card generation
export interface CardGenerationRequest {
    language: string; // Two-character language code (zh, de, fr, jp)
    modelName: string; // Specific LLM model to use
    userPrompt: string; // The actual request text
}

// Simple representation of a pending card to be sent to Anki
export interface PendingCard {
    fields: Record<string, string>; // The card content
}

// Response type for card generation API
export type CardGenerationResponse = PendingCard[];
