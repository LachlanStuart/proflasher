"use client";

import { useEffect, useRef, useState } from "react";
import { type RowOrientedCard, columnToRowOriented, rowToColumnOriented } from "~/lib/cardModel/tableCard";
import { useFlashcard } from "~/lib/context/FlashcardContext";
import { RowOrientedCardEditor } from "./RowOrientedCardEditor";

// Define the CardProposalMessageType locally to fix import error
interface CardProposalMessageType {
    type: "card_proposal";
    cards: RowOrientedCard[];
    error?: string;
    beforeCardsMessageToUser?: string;
    afterCardsMessageToUser?: string;
}

// Define the CardAdditionSummaryType locally
interface CardAdditionSummaryType {
    type: "card_addition_summary";
    successes: Array<{ noteId: number; key: string }>;
    errors: Array<{ key: string; error: string }>;
    duplicates: Array<{
        noteId: number;
        key: string;
        fields: Record<string, string>;
        modelName: string;
        activeCardTypes: string[];
    }>;
    updates: Array<{ noteId: number; key: string }>;
}

interface CardProposalMessageProps {
    message: CardProposalMessageType;
    onAddToAnki: (
        card: Record<string, string>,
        modelName: string,
        activeCardTypes: string[],
        update?: boolean,
        noteId?: number,
    ) => Promise<CardAdditionSummaryType | void>;
    onShowInAnki: (noteId: number) => void;
    onUpdate: (modelName: string, fields: Record<string, string>, activeCardTypes: string[], noteId: number) => void;
}

export function CardProposalMessage({ message, onAddToAnki, onShowInAnki, onUpdate }: CardProposalMessageProps) {
    const { language, activeCardTypes, setActiveCardTypes, template } = useFlashcard();

    // Use the row-oriented cards directly
    const [editedRowCards, setEditedRowCards] = useState<RowOrientedCard[]>(() => {
        return message.cards;
    });

    const [selectedCard, setSelectedCard] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isAddingAll, setIsAddingAll] = useState(false);

    // State for addition summary
    const [additionSummary, setAdditionSummary] = useState<CardAdditionSummaryType | null>(null);
    const [showSummaryDetails, setShowSummaryDetails] = useState(false);

    // Handle row-oriented card changes
    const handleRowCardChange = (newCard: RowOrientedCard) => {
        const updatedRowCards = [...editedRowCards];
        updatedRowCards[selectedCard] = newCard;
        setEditedRowCards(updatedRowCards);
    };

    // Handle previous/next card navigation
    const goToPreviousCard = () => {
        if (selectedCard > 0) {
            setSelectedCard(selectedCard - 1);
        }
    };

    const goToNextCard = () => {
        if (selectedCard < editedRowCards.length - 1) {
            setSelectedCard(selectedCard + 1);
        }
    };

    // Handle card submission with summary tracking
    const handleSubmit = async () => {
        setIsSubmitting(true);
        try {
            // Convert to column-oriented format for Anki compatibility
            const cardToSubmit = rowToColumnOriented(editedRowCards[selectedCard]!, template.tableDefinitions);
            const result = await onAddToAnki(cardToSubmit, template.noteType, activeCardTypes);

            // If the result is a summary, store it
            if (result && typeof result === 'object' && 'type' in result && result.type === 'card_addition_summary') {
                setAdditionSummary(result as CardAdditionSummaryType);
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    // Handle adding all cards from this proposal with summary tracking
    const handleAddAllCards = async () => {
        if (isAddingAll) return;

        setIsAddingAll(true);
        try {
            let allSuccesses: Array<{ noteId: number; key: string }> = [];
            let allErrors: Array<{ key: string; error: string }> = [];
            let allDuplicates: Array<{
                noteId: number;
                key: string;
                fields: Record<string, string>;
                modelName: string;
                activeCardTypes: string[];
            }> = [];
            let allUpdates: Array<{ noteId: number; key: string }> = [];

            // Add each card from this proposal one by one
            for (let i = 0; i < editedRowCards.length; i++) {
                const cardToSubmit = rowToColumnOriented(editedRowCards[i]!, template.tableDefinitions);
                const result = await onAddToAnki(cardToSubmit, template.noteType, activeCardTypes);

                // Collect results if they're summaries
                if (result && typeof result === 'object' && 'type' in result && result.type === 'card_addition_summary') {
                    const summary = result as CardAdditionSummaryType;
                    allSuccesses.push(...summary.successes);
                    allErrors.push(...summary.errors);
                    allDuplicates.push(...summary.duplicates);
                    allUpdates.push(...summary.updates);
                }
            }

            // Create combined summary
            if (allSuccesses.length > 0 || allErrors.length > 0 || allDuplicates.length > 0 || allUpdates.length > 0) {
                setAdditionSummary({
                    type: 'card_addition_summary',
                    successes: allSuccesses,
                    errors: allErrors,
                    duplicates: allDuplicates,
                    updates: allUpdates,
                });
            }
        } finally {
            setIsAddingAll(false);
        }
    };

    // Generate summary text for the addition summary
    const getSummaryText = (summary: CardAdditionSummaryType) => {
        const parts = [];
        if (summary.successes.length > 0) {
            parts.push(`${summary.successes.length} added`);
        }
        if (summary.updates.length > 0) {
            parts.push(`${summary.updates.length} updated`);
        }
        if (summary.errors.length > 0) {
            parts.push(`${summary.errors.length} failed`);
        }
        if (summary.duplicates.length > 0) {
            parts.push(`${summary.duplicates.length} duplicate${summary.duplicates.length === 1 ? "" : "s"}`);
        }

        return parts.join(", ");
    };

    // Get current card
    const currentRowCard = editedRowCards[selectedCard]!;

    return (
        <div className="mb-4 flex">
            <div className="w-full max-w-[95%] rounded-lg border border-green-200 bg-green-50 px-4 py-3">
                <div className="mb-2 flex items-center justify-between">
                    <div className="font-bold text-green-700">
                        💡 Card Proposal ({selectedCard + 1}/{editedRowCards.length})
                    </div>
                </div>

                {message.error ? (
                    <div className="mb-4 rounded border border-red-200 bg-red-50 p-2 text-red-500">{message.error}</div>
                ) : (
                    <>
                        {/* Card navigation if multiple cards */}
                        {editedRowCards.length > 1 && (
                            <div className="mb-4 flex items-center gap-1">
                                <button
                                    onClick={goToPreviousCard}
                                    disabled={selectedCard === 0}
                                    className="rounded bg-gray-200 px-3 py-1 text-gray-700 disabled:bg-gray-100 disabled:text-gray-400"
                                >
                                    &lt;
                                </button>
                                {editedRowCards.map((_, index) => (
                                    <button
                                        key={index}
                                        onClick={() => setSelectedCard(index)}
                                        className="rounded bg-gray-200 px-3 py-1 text-gray-700 disabled:bg-green-600 disabled:text-white"
                                        disabled={selectedCard === index}
                                    >
                                        {index + 1}
                                    </button>
                                ))}
                                <button
                                    onClick={goToNextCard}
                                    disabled={selectedCard === editedRowCards.length - 1}
                                    className="rounded bg-gray-200 px-3 py-1 text-gray-700 disabled:bg-gray-100 disabled:text-gray-400"
                                >
                                    &gt;
                                </button>
                                <div className="flex-grow" />
                                <button
                                    onClick={handleAddAllCards}
                                    disabled={isAddingAll || isSubmitting}
                                    className="rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:bg-gray-400"
                                >
                                    {isAddingAll ? "Adding all..." : "Add all to anki"}
                                </button>
                            </div>
                        )}

                        {/* Card content */}
                        <div className="mb-4">
                            <RowOrientedCardEditor
                                card={currentRowCard}
                                tableDefinitions={template.tableDefinitions}
                                onCardChange={handleRowCardChange}
                            />
                        </div>

                        {/* Card type selection and Add button in same row */}
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex flex-wrap gap-2">
                                <h3 className="font-semibold text-gray-700">Card types:</h3>
                                {Object.entries(template.cardDescriptions).map(([type, description]) => (
                                    <label key={type} className="flex items-center gap-1">
                                        <input
                                            type="checkbox"
                                            checked={activeCardTypes.includes(type)}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setActiveCardTypes([...activeCardTypes, type]);
                                                } else {
                                                    setActiveCardTypes(activeCardTypes.filter((t) => t !== type));
                                                }
                                            }}
                                            className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                                        />
                                        <span className="text-sm">{description}</span>
                                    </label>
                                ))}
                            </div>
                            <button
                                onClick={handleSubmit}
                                disabled={isSubmitting || isAddingAll}
                                className="rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:bg-gray-400"
                            >
                                {isSubmitting ? "Adding..." : "Add to Anki"}
                            </button>
                        </div>
                    </>
                )}

                {message.afterCardsMessageToUser && (
                    <div className="mt-3 text-green-700">{message.afterCardsMessageToUser}</div>
                )}

                {/* Addition Summary Section */}
                {additionSummary && (
                    <div className="mt-4 border-t border-green-300 pt-4">
                        <div className="font-mono text-sm">
                            <div className="mb-1 font-bold text-green-600">
                                ✅ Added {additionSummary.successes.length + additionSummary.errors.length + additionSummary.duplicates.length + additionSummary.updates.length} card{(additionSummary.successes.length + additionSummary.errors.length + additionSummary.duplicates.length + additionSummary.updates.length) === 1 ? "" : "s"}
                                {additionSummary.errors.length + additionSummary.duplicates.length > 0 && (
                                    <span className="ml-2 text-orange-600">
                                        ({additionSummary.errors.length + additionSummary.duplicates.length} need{(additionSummary.errors.length + additionSummary.duplicates.length) === 1 ? "s" : ""} action)
                                    </span>
                                )}
                            </div>
                            <div className="mb-2">
                                <span className="text-gray-600">{getSummaryText(additionSummary)}</span>
                                <button
                                    onClick={() => setShowSummaryDetails(!showSummaryDetails)}
                                    className="ml-2 text-blue-500 text-xs hover:underline"
                                >
                                    {showSummaryDetails ? "hide details" : "show details"}
                                </button>
                            </div>

                            {showSummaryDetails && (
                                <div className="mt-2 space-y-3 border-gray-300 border-t pt-2">
                                    {/* Successes */}
                                    {additionSummary.successes.length > 0 && (
                                        <div>
                                            <div className="mb-1 font-semibold text-green-600 text-xs">
                                                ✅ Successfully Added ({additionSummary.successes.length})
                                            </div>
                                            <div className="space-y-1">
                                                {additionSummary.successes.map((success, index) => (
                                                    <div key={index} className="border-green-200 border-l-2 pl-2 text-xs">
                                                        <span className="font-mono">#{success.noteId}</span> - {success.key}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Updates */}
                                    {additionSummary.updates.length > 0 && (
                                        <div>
                                            <div className="mb-1 font-semibold text-blue-600 text-xs">
                                                🔄 Updated ({additionSummary.updates.length})
                                            </div>
                                            <div className="space-y-1">
                                                {additionSummary.updates.map((update, index) => (
                                                    <div key={index} className="border-blue-200 border-l-2 pl-2 text-xs">
                                                        <span className="font-mono">#{update.noteId}</span> - {update.key}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Duplicates */}
                                    {additionSummary.duplicates.length > 0 && (
                                        <div>
                                            <div className="mb-1 font-semibold text-xs text-yellow-600">
                                                ⚠️ Duplicates Need Action ({additionSummary.duplicates.length})
                                            </div>
                                            <div className="space-y-2">
                                                {additionSummary.duplicates.map((duplicate, index) => (
                                                    <div key={index} className="border-yellow-200 border-l-2 pl-2 text-xs">
                                                        <div className="mb-1">
                                                            <span className="font-mono">#{duplicate.noteId}</span> -{" "}
                                                            {duplicate.key}
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => onShowInAnki(duplicate.noteId)}
                                                                className="rounded bg-blue-500 px-2 py-1 text-white text-xs hover:bg-blue-600"
                                                            >
                                                                Show in Anki
                                                            </button>
                                                            <button
                                                                onClick={async () => {
                                                                    try {
                                                                        await onUpdate(
                                                                            duplicate.modelName,
                                                                            duplicate.fields,
                                                                            duplicate.activeCardTypes,
                                                                            duplicate.noteId,
                                                                        );

                                                                        // Update the local summary state
                                                                        if (additionSummary) {
                                                                            const updatedSummary: CardAdditionSummaryType = {
                                                                                ...additionSummary,
                                                                                updates: [...additionSummary.updates, { noteId: duplicate.noteId, key: duplicate.key }],
                                                                                // Remove from duplicates
                                                                                duplicates: additionSummary.duplicates.filter((d) => d.noteId !== duplicate.noteId),
                                                                            };
                                                                            setAdditionSummary(updatedSummary);
                                                                        }
                                                                    } catch (error) {
                                                                        console.error("Error updating note:", error);

                                                                        // Update summary with error
                                                                        if (additionSummary) {
                                                                            const updatedSummary: CardAdditionSummaryType = {
                                                                                ...additionSummary,
                                                                                errors: [
                                                                                    ...additionSummary.errors,
                                                                                    {
                                                                                        key: duplicate.key,
                                                                                        error: `Update failed: ${error instanceof Error ? error.message : String(error)}`,
                                                                                    },
                                                                                ],
                                                                            };
                                                                            setAdditionSummary(updatedSummary);
                                                                        }
                                                                    }
                                                                }}
                                                                className="rounded bg-green-500 px-2 py-1 text-white text-xs hover:bg-green-600"
                                                            >
                                                                Update
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Errors */}
                                    {additionSummary.errors.length > 0 && (
                                        <div>
                                            <div className="mb-1 font-semibold text-red-600 text-xs">
                                                ❌ Errors ({additionSummary.errors.length})
                                            </div>
                                            <div className="space-y-1">
                                                {additionSummary.errors.map((error, index) => (
                                                    <div key={index} className="border-red-200 border-l-2 pl-2 text-xs">
                                                        <div className="text-red-600">
                                                            {error.key}: {error.error}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
