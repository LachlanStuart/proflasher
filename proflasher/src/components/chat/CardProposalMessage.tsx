import { useState, useRef, useEffect } from "react";
import { CardProposalMessage as CardProposalMessageType } from "~/app/chat/page";
import templates from "~/lib/cardModel/noteTemplates";

interface CardProposalMessageProps {
    message: CardProposalMessageType;
    language: string;
    onAddToAnki: (card: Record<string, string>, modelName: string) => Promise<void>;
}

export function CardProposalMessage({ message, language, onAddToAnki }: CardProposalMessageProps) {
    const [editedCards, setEditedCards] = useState<Record<string, string>[]>(
        message.cards.map(card => ({ ...card }))
    );
    const [selectedCard, setSelectedCard] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const textareaRefs = useRef<{ [field: string]: HTMLTextAreaElement | null }>({});

    // Auto-resize textareas on content change
    const resizeTextarea = (textarea: HTMLTextAreaElement) => {
        if (!textarea) return;

        // Reset height to measure scrollHeight correctly
        textarea.style.height = 'auto';

        // Calculate new height (with a maximum of 4 rows)
        const lineHeight = parseInt(getComputedStyle(textarea).lineHeight) || 20;
        const maxHeight = lineHeight * 4;
        const newHeight = Math.min(textarea.scrollHeight, maxHeight);

        textarea.style.height = `${newHeight}px`;
        textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
    };

    // Handle field changes
    const handleFieldChange = (field: string, value: string) => {
        const updatedCards = [...editedCards];
        updatedCards[selectedCard] = {
            ...updatedCards[selectedCard],
            [field]: value
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
        Object.values(textareaRefs.current).forEach(textarea => {
            if (textarea) resizeTextarea(textarea);
        });
    }, [selectedCard]);

    // Handle card submission
    const handleSubmit = async () => {
        setIsSubmitting(true);
        try {
            await onAddToAnki(editedCards[selectedCard]!, template.noteType);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Get current card
    const currentCard = editedCards[selectedCard]!;

    // Get template for field ordering
    const template = templates[language];
    if (!template) {
        return <div className="text-red-500 mb-4 p-2 bg-red-50 rounded border border-red-200">
            Template not found for language {language}
        </div>
    }

    // Generate ordered fields based on template.fieldOrder if available
    const orderedFields = Object.keys(template.fieldDescriptions).map(field => [field, currentCard[field] || ''])

    return (
        <div className="flex mb-4">
            <div className="bg-green-50 px-4 py-3 rounded-lg max-w-[90%] w-full border border-green-200">
                <div className="font-bold text-green-700 mb-2">
                    💡 Card Proposal ({selectedCard + 1}/{editedCards.length})
                </div>

                {message.error ? (
                    <div className="text-red-500 mb-4 p-2 bg-red-50 rounded border border-red-200">
                        {message.error}
                    </div>
                ) : (
                    <>
                        {/* Card navigation if multiple cards */}
                        {editedCards.length > 1 && (
                            <div className="flex mb-4 gap-1">
                                {editedCards.map((_, index) => (
                                    <button
                                        key={index}
                                        onClick={() => setSelectedCard(index)}
                                        className={`px-3 py-1 rounded ${selectedCard === index
                                            ? "bg-green-600 text-white"
                                            : "bg-gray-200 text-gray-700"
                                            }`}
                                    >
                                        {index + 1}
                                    </button>
                                ))}
                            </div>
                        )}

                        <div className="grid gap-3 mb-4">
                            {orderedFields.map(([field, value]) => (
                                <div key={field} className="flex flex-col">
                                    <label className="font-medium text-gray-700 mb-1">
                                        {field}:
                                        {template.fieldDescriptions[field] && field !== "JsonData" && (
                                            <span className="ml-1 text-xs text-gray-500">
                                                ({template.fieldDescriptions[field]})
                                            </span>
                                        )}
                                    </label>
                                    <textarea
                                        ref={el => textareaRefs.current[field] = el}
                                        value={value}
                                        onChange={(e) => handleFieldChange(field, e.target.value)}
                                        className="border border-gray-300 rounded p-1 overflow-hidden"
                                        onInput={(e) => resizeTextarea(e.target as HTMLTextAreaElement)}
                                        rows={1}
                                    />
                                </div>
                            ))}
                        </div>

                        <div className="flex justify-end">
                            <button
                                onClick={handleSubmit}
                                disabled={isSubmitting}
                                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded disabled:bg-gray-400"
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
