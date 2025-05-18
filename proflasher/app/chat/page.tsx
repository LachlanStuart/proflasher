"use client";

import { useRef, useState } from "react";
import { AnkiSearchMessage } from "~/components/chat/AnkiSearchMessage";
import { CardProposalMessage } from "~/components/chat/CardProposalMessage";
import { ErrorMessage } from "~/components/chat/ErrorMessage";
import { LLMMessage } from "~/components/chat/LLMMessage";
import { UserMessage } from "~/components/chat/UserMessage";

// LLM model name
const LLM_MODEL_NAME = "gemini-2.5-flash-preview-04-17";

// Message types for conversation history
interface UserMessage {
    type: "user";
    content: string;
}

interface LLMMessage {
    type: "llm";
    content: string;
}

interface ErrorMessage {
    type: "error";
    content: string;
}

interface AnkiSearchMessage {
    type: "anki_search";
    query: string;
    results: Array<Record<string, any>>;
    error?: string;
}

interface CardProposalMessage {
    type: "card_proposal";
    cards: Array<Record<string, string>>;
    error?: string;
}

type ConversationMessage =
    | UserMessage
    | LLMMessage
    | ErrorMessage
    | AnkiSearchMessage
    | CardProposalMessage;

export default function ChatPage() {
    const [messages, setMessages] = useState<ConversationMessage[]>([]);
    const [inputText, setInputText] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const messageEndRef = useRef<HTMLDivElement>(null);

    // Get language from localStorage (it's managed in the Header component now)
    const getSelectedLanguage = () => {
        if (typeof window !== "undefined") {
            return localStorage.getItem("selectedLanguage") || "fr";
        }
        return "fr";
    };

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
                    lang: getSelectedLanguage(),
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
                    { type: "user", content: userPrompt } as UserMessage,
                    { type: "error", content: errorMessage } as ErrorMessage,
                ];
            }

            return await response.json();
        } catch (error) {
            console.error("Error calling LLM API:", error);
            const errorMessage =
                error instanceof Error ? error.message : String(error);

            // Return the conversation with an error message
            return [
                ...conversationHistory,
                { type: "user", content: userPrompt } as UserMessage,
                { type: "error", content: `Error: ${errorMessage}` } as ErrorMessage,
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

    // Handle adding card to Anki
    const handleAddToAnki = async (
        card: Record<string, string>,
        modelName: string,
    ) => {
        try {
            // Add note to Anki via server API
            const response = await fetch("/api/anki", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    action: "addNote",
                    params: { fields: card, modelName },
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to add card to Anki");
            }

            const noteId = await response.json();

            if (noteId) {
                // Success message
                setMessages((prev) => [
                    ...prev,
                    {
                        type: "llm",
                        content: `Card added successfully to Anki! Note ID: ${noteId}`,
                    },
                ]);

                // Scroll to bottom after adding a card
                setTimeout(() => {
                    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
                }, 100);
            } else {
                throw new Error("Failed to add card to Anki");
            }
        } catch (error) {
            console.error("Error adding card to Anki:", error);
            setMessages((prev) => [
                ...prev,
                {
                    type: "error",
                    content: `Failed to add card to Anki: ${error instanceof Error ? error.message : String(error)}`,
                },
            ]);
        }
    };

    return (
        <div className="flex flex-col h-[calc(100vh-80px)]">
            {/* Message container */}
            <div className="mb-4 flex-1 overflow-y-auto rounded border bg-gray-50 p-4">
                {messages.length === 0 ? (
                    <div className="p-4 text-center text-gray-400">
                        Start a conversation by typing a message below.
                    </div>
                ) : (
                    messages.map((message, index) => {
                        switch (message.type) {
                            case "user":
                                return <UserMessage key={index} message={message} />;
                            case "llm":
                                return <LLMMessage key={index} message={message} />;
                            case "error":
                                return <ErrorMessage key={index} message={message} />;
                            case "anki_search":
                                return <AnkiSearchMessage key={index} message={message} />;
                            case "card_proposal":
                                return (
                                    <CardProposalMessage
                                        key={index}
                                        message={message}
                                        language={getSelectedLanguage()}
                                        onAddToAnki={handleAddToAnki}
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
            <form onSubmit={handleSubmit} className="flex gap-2 mb-4">
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
