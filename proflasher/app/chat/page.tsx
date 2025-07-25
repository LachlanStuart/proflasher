"use client";

import type React from "react";
import { useRef, useState } from "react";
import { AnkiSearchMessage } from "~/components/chat/AnkiSearchMessage";

import { CardProposalMessage } from "~/components/chat/CardProposalMessage";
import { ErrorMessage } from "~/components/chat/ErrorMessage";
import { GetNotesMessage } from "~/components/chat/GetNotesMessage";
import { LLMMessage } from "~/components/chat/LLMMessage";
import { UserMessage } from "~/components/chat/UserMessage";
import type { RowOrientedCard } from "~/lib/cardModel/tableCard";
import { useFlashcard } from "~/lib/context/FlashcardContext";

// LLM model name
const LLM_MODEL_NAME = "gemini-2.5-pro";
// const LLM_MODEL_NAME = "gemini-2.5-flash-preview-04-17";

// Message types for conversation history
interface UserMessageType {
    type: "user";
    content: string;
}

interface LLMMessageType {
    type: "llm";
    content: string;
}

interface ErrorMessageType {
    type: "error";
    content: string;
}

interface AnkiSearchMessageType {
    type: "anki_search";
    query: string;
    results: Array<Record<string, any>>;
    error?: string;
}

interface CardProposalMessageType {
    type: "card_proposal";
    cards: RowOrientedCard[];
    error?: string;
}

interface GetNotesMessageType {
    type: "get_notes";
    keys: string[];
    noteInfos: any[] | null;
    error?: string;
}

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

type ConversationMessage =
    | UserMessageType
    | LLMMessageType
    | ErrorMessageType
    | AnkiSearchMessageType
    | CardProposalMessageType
    | GetNotesMessageType;

export default function ChatPage() {
    const [messages, setMessages] = useState<ConversationMessage[]>([]);
    const [inputText, setInputText] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const messageEndRef = useRef<HTMLDivElement>(null);
    const { language } = useFlashcard();

    // Call LLM API
    async function callLLM(
        userPrompt: string,
        conversationHistory: ConversationMessage[] = [],
    ): Promise<ConversationMessage[]> {
        try {
            const response = await fetch("/api/llm/chat", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    lang: language,
                    modelName: LLM_MODEL_NAME,
                    userPrompt,
                    conversationHistory,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                const errorMessage = errorData.error || "Failed to call LLM API";
                // Return conversation with an error message
                return [
                    ...conversationHistory,
                    { type: "user", content: userPrompt } as UserMessageType,
                    { type: "error", content: errorMessage } as ErrorMessageType,
                ];
            }

            return await response.json();
        } catch (error) {
            console.error("Error calling LLM API:", error);
            const errorMessage = error instanceof Error ? error.message : String(error);

            // Return the conversation with an error message
            return [
                ...conversationHistory,
                { type: "user", content: userPrompt } as UserMessageType,
                {
                    type: "error",
                    content: `Error: ${errorMessage}`,
                } as ErrorMessageType,
            ];
        }
    }

    // Handle form submission
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isLoading) return;

        // Add user message
        const userMessage = { type: "user", content: inputText } as const;
        setMessages((prev) => [...prev, userMessage]);
        setInputText("");
        setIsLoading(true);

        try {
            // Call LLM with user input
            const newMessages = await callLLM(inputText, messages);

            // Update with response from LLM
            setMessages(newMessages);

            // Scroll to bottom only after user interaction
            setTimeout(() => {
                messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
            }, 100);
        } catch (error) {
            console.error("Error calling LLM:", error);
            // Add error message
            setMessages((prev) => [
                ...prev,
                {
                    type: "error",
                    content: `An error occurred: ${error instanceof Error ? error.message : String(error)}`,
                },
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    // Handle clear conversation
    const handleClear = () => {
        setMessages([]);
    };

    // Handle rewind to a specific message
    const handleRewind = (index: number) => {
        const messageToRewind = messages[index];
        if (messageToRewind && messageToRewind.type === "user") {
            // Put the message content back in the input
            setInputText((messageToRewind as UserMessageType).content);
            // Truncate conversation history to remove this message and everything after it
            setMessages(messages.slice(0, index));
        }
    };

    // Handle showing note in Anki
    const handleShowInAnki = async (noteId: number) => {
        try {
            await fetch("/api/anki", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    action: "guiSelectCard",
                    params: { card: noteId },
                }),
            });
        } catch (error) {
            console.error("Error showing note in Anki:", error);
        }
    };



    // Handle updating existing note
    const handleUpdateNote = async (
        modelName: string,
        fields: Record<string, string>,
        activeCardTypes: string[],
        noteId: number,
    ) => {
        try {
            await fetch("/api/anki/cards", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    modelName,
                    fields,
                    activeCardTypes,
                    update: true,
                    noteId,
                }),
            });
        } catch (error) {
            console.error("Error updating note:", error);
            throw error; // Re-throw so the component can handle it
        }
    };

    // Handle adding card to Anki
    const handleAddToAnki = async (card: Record<string, string>, modelName: string, activeCardTypes: string[]): Promise<CardAdditionSummaryType | void> => {
        try {
            // Add note to Anki via server API
            const response = await fetch("/api/anki/cards", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    modelName,
                    fields: card,
                    activeCardTypes,
                }),
            });

            const data = await response.json();

            if (response.status === 409) {
                // Handle duplicate card - return summary for component to handle
                return {
                    type: "card_addition_summary" as const,
                    successes: [],
                    errors: [],
                    duplicates: [
                        {
                            noteId: data.noteId,
                            key: card.Key || `Note ${data.noteId}`,
                            fields: card,
                            modelName,
                            activeCardTypes,
                        },
                    ],
                    updates: [],
                };
            }

            if (!response.ok) {
                throw new Error(data.error || "Failed to add card to Anki");
            }

            const { noteId } = data;

            if (noteId) {
                // Return success summary for component to handle
                return {
                    type: "card_addition_summary" as const,
                    successes: [{ noteId, key: card.Key || `Note ${noteId}` }],
                    errors: [],
                    duplicates: [],
                    updates: [],
                };
            } else {
                throw new Error("Failed to add card to Anki");
            }
        } catch (error) {
            console.error("Error adding card to Anki:", error);

            // Return error summary for component to handle
            return {
                type: "card_addition_summary" as const,
                successes: [],
                errors: [
                    {
                        key: card.Key || "Unknown card",
                        error: error instanceof Error ? error.message : String(error),
                    },
                ],
                duplicates: [],
                updates: [],
            };
        }
    };

    return (
        <div className="flex h-[calc(100vh-80px)] flex-col">
            {/* Message container */}
            <div className="mb-4 flex-1 overflow-y-auto rounded border bg-gray-50 p-4">
                {messages.length === 0 ? (
                    <div className="p-4 text-center text-gray-400">Start a conversation by typing a message below.</div>
                ) : (
                    messages.map((message, index) => {
                        switch (message.type) {
                            case "user":
                                return (
                                    <UserMessage key={index} message={message} onRewind={() => handleRewind(index)} />
                                );
                            case "llm":
                                return <LLMMessage key={index} message={message} />;
                            case "error":
                                return <ErrorMessage key={index} message={message} />;
                            case "anki_search":
                                return <AnkiSearchMessage key={index} message={message} />;
                            case "get_notes":
                                return <GetNotesMessage key={index} message={message} />;
                            case "card_proposal":
                                return (
                                    <CardProposalMessage
                                        key={index}
                                        message={message}
                                        onAddToAnki={handleAddToAnki}
                                        onShowInAnki={handleShowInAnki}
                                        onUpdate={handleUpdateNote}
                                    />
                                );


                            default:
                                return null;
                        }
                    })
                )}
                <div ref={messageEndRef} />
            </div>

            {/* Input form */}
            <form onSubmit={handleSubmit} className="mb-4 flex gap-2">
                <textarea
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 resize-y rounded border p-2"
                    rows={3}
                    disabled={isLoading}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && e.shiftKey === false && !isLoading) {
                            e.preventDefault();
                            handleSubmit(e);
                        }
                    }}
                />
                <div className="flex flex-col gap-2">
                    <button
                        type="submit"
                        className="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 disabled:bg-blue-300"
                        disabled={isLoading}
                    >
                        {isLoading ? "Sending..." : "Send"}
                    </button>
                    <button
                        type="button"
                        onClick={handleClear}
                        className="rounded bg-gray-500 px-4 py-2 text-white hover:bg-gray-600 disabled:bg-gray-300"
                        disabled={isLoading}
                    >
                        Clear
                    </button>
                </div>
            </form>
        </div>
    );
}
