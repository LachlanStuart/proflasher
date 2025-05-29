import { useEffect, useRef, useState } from "react";
import { useFlashcard } from "~/lib/context/FlashcardContext";
import { RowOrientedCardEditor } from "./RowOrientedCardEditor";
import {
    rowToColumnOriented,
    columnToRowOriented,
    type RowOrientedCard
} from "~/lib/cardModel/tableCard";

// Define the CardProposalMessageType locally to fix import error
interface CardProposalMessageType {
    type: "card_proposal";
    cards: Array<Record<string, string>>;
    error?: string;
    beforeCardsMessageToUser?: string;
    afterCardsMessageToUser?: string;
}

interface CardProposalMessageProps {
    message: CardProposalMessageType;
    onAddToAnki: (
        card: Record<string, string>,
        modelName: string,
        activeCardTypes: string[],
        update?: boolean,
        noteId?: number
    ) => Promise<void>;
}

export function CardProposalMessage({
    message,
    onAddToAnki,
}: CardProposalMessageProps) {
    const { language, activeCardTypes, setActiveCardTypes, template } = useFlashcard();

    // Convert column-oriented cards to row-oriented for editing
    const [editedRowCards, setEditedRowCards] = useState<RowOrientedCard[]>(() => {
        return message.cards.map(card =>
            columnToRowOriented(card, template.tableDefinitions)
        );
    });

    const [selectedCard, setSelectedCard] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isAddingAll, setIsAddingAll] = useState(false);

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

    // Handle card submission
    const handleSubmit = async () => {
        setIsSubmitting(true);
        try {
            // Convert to column-oriented format for Anki compatibility
            const cardToSubmit = rowToColumnOriented(editedRowCards[selectedCard]!, template.tableDefinitions);
            await onAddToAnki(cardToSubmit, template.noteType, activeCardTypes);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Handle adding all cards from this proposal
    const handleAddAllCards = async () => {
        if (isAddingAll) return;

        setIsAddingAll(true);
        try {
            // Add each card from this proposal one by one
            for (let i = 0; i < editedRowCards.length; i++) {
                const cardToSubmit = rowToColumnOriented(editedRowCards[i]!, template.tableDefinitions);
                await onAddToAnki(cardToSubmit, template.noteType, activeCardTypes);
            }
        } finally {
            setIsAddingAll(false);
        }
    };

    // Get current card
    const currentRowCard = editedRowCards[selectedCard]!;

    return (
        <div className="mb-4 flex">
            <div className="w-full max-w-[95%] rounded-lg border border-green-200 bg-green-50 px-4 py-3">
                {message.beforeCardsMessageToUser && (
                    <div className="mb-3 text-green-700">
                        {message.beforeCardsMessageToUser}
                    </div>
                )}

                <div className="mb-2 flex items-center justify-between">
                    <div className="font-bold text-green-700">
                        💡 Card Proposal ({selectedCard + 1}/{editedRowCards.length})
                    </div>
                </div>

                {message.error ? (
                    <div className="mb-4 rounded border border-red-200 bg-red-50 p-2 text-red-500">
                        {message.error}
                    </div>
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
                                        className="rounded bg-green-600 px-3 py-1 text-white disabled:bg-gray-200 disabled:text-gray-700"
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
                                {Object.entries(template.cardDescriptions).map(([type, description]) => (
                                    <label key={type} className="flex items-center gap-1">
                                        <input
                                            type="checkbox"
                                            checked={activeCardTypes.includes(type)}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setActiveCardTypes([...activeCardTypes, type]);
                                                } else {
                                                    setActiveCardTypes(activeCardTypes.filter(t => t !== type));
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
                    <div className="mt-3 text-green-700">
                        {message.afterCardsMessageToUser}
                    </div>
                )}
            </div>
        </div>
    );
}
