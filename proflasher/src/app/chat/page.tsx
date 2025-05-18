"use client";

import { useState, useRef, useEffect } from "react";
import { UserMessage } from "~/components/chat/UserMessage";
import { LLMMessage } from "~/components/chat/LLMMessage";
import { AnkiSearchMessage } from "~/components/chat/AnkiSearchMessage";
import { CardProposalMessage } from "~/components/chat/CardProposalMessage";
import { ErrorMessage } from "~/components/chat/ErrorMessage";
import templates from "~/lib/cardModel/noteTemplates";

// LLM model names
const LLM_MODEL_NAME = [
    "gemini-2.5-flash-preview-04-17",
    "gemini-2.5-pro-exp-03-25",
];

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
    const [selectedLanguage, setSelectedLanguage] = useState("zh");
    const [selectedModel, setSelectedModel] = useState<string>(LLM_MODEL_NAME[0]);
    const [availableLanguages, setAvailableLanguages] = useState<string[]>([]);
    const [isAddingAllCards, setIsAddingAllCards] = useState(false);
    const messageEndRef = useRef<HTMLDivElement>(null);

    // Fetch available languages on mount
    useEffect(() => {
        const fetchLanguages = async () => {
            try {
                const response = await fetch("/api/settings/languages");
                if (!response.ok) throw new Error("Failed to fetch languages");
                const data = await response.json();
                setAvailableLanguages(data);
                if (data.length > 0 && !data.includes(selectedLanguage)) {
                    setSelectedLanguage(data[0]);
                }
            } catch (error) {
                console.error("Error fetching languages:", error);
            }
        };

        fetchLanguages();
    }, []);

    // Scroll to bottom when messages change
    useEffect(() => {
        messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Call LLM API
    async function callLLM(
        lang: string,
        modelName: string,
        userPrompt: string,
        conversationHistory: ConversationMessage[] = []
    ): Promise<ConversationMessage[]> {
        try {
            const response = await fetch('/api/llm/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    lang,
                    modelName,
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
                    { type: "error", content: errorMessage } as ErrorMessage
                ];
            }

            return await response.json();
        } catch (error) {
            console.error("Error calling LLM API:", error);
            const errorMessage = error instanceof Error ? error.message : String(error);

            // Return the conversation with an error message
            return [
                ...conversationHistory,
                { type: "user", content: userPrompt } as UserMessage,
                { type: "error", content: `Error: ${errorMessage}` } as ErrorMessage
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
            const newMessages = await callLLM(
                selectedLanguage,
                selectedModel,
                inputText,
                messages
            );

            // Update with response from LLM
            setMessages(newMessages);
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
    const handleAddToAnki = async (card: Record<string, string>, modelName: string) => {
        try {
            // Add note to Anki via server API
            const response = await fetch('/api/anki', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'addNote',
                    params: { fields: card, modelName }
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

    // Handle adding all cards
    const handleAddAllCards = async () => {
        if (isAddingAllCards) return;

        setIsAddingAllCards(true);
        const templateName = templates[selectedLanguage]?.noteType!;

        try {
            // Find all card proposal messages
            const cardProposals = messages.filter(
                (msg): msg is CardProposalMessage => msg.type === "card_proposal"
            );
            // Add each card one by one
            for (const proposal of cardProposals) {
                for (const card of proposal.cards) {
                    await handleAddToAnki(card, templateName);
                }
            }

            // Final success message
            setMessages((prev) => [
                ...prev,
                {
                    type: "llm",
                    content: "All cards have been added to Anki!",
                },
            ]);
        } catch (error) {
            console.error("Error adding all cards:", error);
            setMessages((prev) => [
                ...prev,
                {
                    type: "error",
                    content: `Failed to add all cards: ${error instanceof Error ? error.message : String(error)}`,
                },
            ]);
        } finally {
            setIsAddingAllCards(false);
        }
    };

    return (
        <div className="flex flex-col h-screen p-4">
            <div className="mb-4">
                <h1 className="text-xl font-bold">Proflasher Chat</h1>
                <div className="flex gap-2 mt-2">
                    <select
                        value={selectedLanguage}
                        onChange={(e) => setSelectedLanguage(e.target.value)}
                        className="p-2 border rounded"
                        disabled={isLoading}
                    >
                        {availableLanguages.map((lang) => (
                            <option key={lang} value={lang}>
                                {lang}
                            </option>
                        ))}
                    </select>
                    <select
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                        className="p-2 border rounded"
                        disabled={isLoading}
                    >
                        {LLM_MODEL_NAME.map((model) => (
                            <option key={model} value={model}>
                                {model}
                            </option>
                        ))}
                    </select>
                    <button
                        onClick={handleAddAllCards}
                        className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:bg-green-300"
                        disabled={isLoading || isAddingAllCards}
                    >
                        {isAddingAllCards ? "Adding..." : "Add All Cards"}
                    </button>
                </div>
            </div>

            {/* Message container */}
            <div className="flex-1 overflow-y-auto border rounded p-4 mb-4 bg-gray-50">
                {messages.length === 0 ? (
                    <div className="text-gray-400 text-center p-4">
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
                                        language={selectedLanguage}
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
            <form onSubmit={handleSubmit} className="flex gap-2">
                <textarea
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 p-2 border rounded resize-y"
                    rows={3}
                    disabled={isLoading}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && e.shiftKey === false && !isLoading) {
                            e.preventDefault();
                            handleSubmit(e);
                        }
                    }}
                />
                <div className="flex flex-col gap-2">
                    <button
                        type="submit"
                        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-blue-300"
                        disabled={isLoading}
                    >
                        {isLoading ? "Sending..." : "Send"}
                    </button>
                    <button
                        type="button"
                        onClick={handleClear}
                        className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 disabled:bg-gray-300"
                        disabled={isLoading}
                    >
                        Clear
                    </button>
                </div>
            </form>
        </div>
    );
}
