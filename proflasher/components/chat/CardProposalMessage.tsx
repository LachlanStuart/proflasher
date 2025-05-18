import { useEffect, useRef, useState } from "react";
import templates from "~/lib/cardModel/noteTemplates";

// Define the CardProposalMessageType locally to fix import error
interface CardProposalMessageType {
    type: "card_proposal";
    cards: Array<Record<string, string>>;
    error?: string;
}

interface CardProposalMessageProps {
    message: CardProposalMessageType;
    language: string;
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
    language,
    onAddToAnki,
}: CardProposalMessageProps) {
    const [editedCards, setEditedCards] = useState<Record<string, string>[]>(
        message.cards.map((card: Record<string, string>) => ({ ...card })),
    );
    const [selectedCard, setSelectedCard] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isAddingAll, setIsAddingAll] = useState(false);
    const textareaRefs = useRef<{ [field: string]: HTMLTextAreaElement | null }>({});
    const [activeCardTypes, setActiveCardTypes] = useState<string[]>(() => {
        if (typeof window === "undefined") return [];
        const saved = localStorage.getItem(`activeCardTypes_${language}`);
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch {
                return [];
            }
        }
        const template = templates[language];
        if (template) {
            return Object.keys(template.cardDescriptions);
        }
        return [];
    });

    // Save active card types to localStorage when they change
    useEffect(() => {
        if (typeof window !== "undefined") {
            localStorage.setItem(`activeCardTypes_${language}`, JSON.stringify(activeCardTypes));
        }
    }, [activeCardTypes, language]);

    // Auto-resize textareas on content change
    const resizeTextarea = (textarea: HTMLTextAreaElement) => {
        if (!textarea) return;

        // Reset height to measure scrollHeight correctly
        textarea.style.height = "auto";

        // Calculate new height (with a maximum of 4 rows)
        const lineHeight =
            Number.parseInt(getComputedStyle(textarea).lineHeight) || 20;
        const maxHeight = lineHeight * 4;
        const newHeight = Math.min(textarea.scrollHeight, maxHeight);

        textarea.style.height = `${newHeight}px`;
        textarea.style.overflowY =
            textarea.scrollHeight > maxHeight ? "auto" : "hidden";
    };

    // Handle field changes
    const handleFieldChange = (field: string, value: string) => {
        const updatedCards = [...editedCards];
        updatedCards[selectedCard] = {
            ...updatedCards[selectedCard],
            [field]: value,
        };
        setEditedCards(updatedCards);

        // Resize the textarea after content change
        setTimeout(() => {
            if (textareaRefs.current[field]) {
                resizeTextarea(textareaRefs.current[field]!);
            }
        }, 0);
    };

    // Initialize textarea heights and resize on card change
    useEffect(() => {
        // Resize all textareas when card changes
        Object.values(textareaRefs.current).forEach((textarea) => {
            if (textarea) resizeTextarea(textarea);
        });
    }, [selectedCard]);

    // Handle previous/next card navigation
    const goToPreviousCard = () => {
        if (selectedCard > 0) {
            setSelectedCard(selectedCard - 1);
        }
    };

    const goToNextCard = () => {
        if (selectedCard < editedCards.length - 1) {
            setSelectedCard(selectedCard + 1);
        }
    };

    // Handle card submission
    const handleSubmit = async () => {
        setIsSubmitting(true);
        try {
            const template = templates[language];
            if (!template) {
                throw new Error(`Template not found for language ${language}`);
            }
            await onAddToAnki(editedCards[selectedCard]!, template.noteType, activeCardTypes);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Handle adding all cards from this proposal
    const handleAddAllCards = async () => {
        if (isAddingAll) return;

        setIsAddingAll(true);
        try {
            const template = templates[language];
            if (!template) {
                throw new Error(`Template not found for language ${language}`);
            }
            // Add each card from this proposal one by one
            for (const card of editedCards) {
                await onAddToAnki(card, template.noteType, activeCardTypes);
            }
        } finally {
            setIsAddingAll(false);
        }
    };

    // Get current card
    const currentCard = editedCards[selectedCard]!;

    // Get template for field ordering
    const template = templates[language];
    if (!template) {
        return (
            <div className="mb-4 rounded border border-red-200 bg-red-50 p-2 text-red-500">
                Template not found for language {language}
            </div>
        );
    }

    // Generate ordered fields based on template.fieldOrder if available
    const orderedFields = Object.keys(template.fieldDescriptions).map(
        (field) => [field, currentCard[field] || ""] as [string, string],
    );

    return (
        <div className="mb-4 flex">
            <div className="w-full max-w-[90%] rounded-lg border border-green-200 bg-green-50 px-4 py-3">
                <div className="mb-2 font-bold text-green-700">
                    💡 Card Proposal ({selectedCard + 1}/{editedCards.length})
                </div>

                {message.error ? (
                    <div className="mb-4 rounded border border-red-200 bg-red-50 p-2 text-red-500">
                        {message.error}
                    </div>
                ) : (
                    <>
                        {/* Card navigation if multiple cards */}
                        {editedCards.length > 1 && (
                            <div className="mb-4 flex items-center gap-1">
                                <button
                                    onClick={goToPreviousCard}
                                    disabled={selectedCard === 0}
                                    className="rounded bg-gray-200 px-3 py-1 text-gray-700 disabled:bg-gray-100 disabled:text-gray-400"
                                >
                                    &lt;
                                </button>
                                {editedCards.map((_, index) => (
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
                                    disabled={selectedCard === editedCards.length - 1}
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

                        <div className="mb-4 grid gap-3">
                            {orderedFields.map(([field, value]) => (
                                <div key={field} className="flex flex-col">
                                    <label className="mb-1 font-medium text-gray-700">
                                        {field}:
                                        {template.fieldDescriptions[field] &&
                                            field !== "JsonData" && (
                                                <span className="ml-1 text-gray-500 text-xs">
                                                    ({template.fieldDescriptions[field]})
                                                </span>
                                            )}
                                    </label>
                                    <textarea
                                        ref={(el) => {
                                            textareaRefs.current[field] = el;
                                        }}
                                        value={value}
                                        onChange={(e) => handleFieldChange(field, e.target.value)}
                                        className="overflow-hidden rounded border border-gray-300 p-1"
                                        onInput={(e) =>
                                            resizeTextarea(e.target as HTMLTextAreaElement)
                                        }
                                        rows={1}
                                    />
                                </div>
                            ))}
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
            </div>
        </div>
    );
}
