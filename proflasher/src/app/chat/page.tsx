"use client";

import { useEffect, useRef, useState } from "react";
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
	const [selectedLanguage, setSelectedLanguage] = useState<string>(() => {
		// Initialize from localStorage if available, otherwise default to "fr"
		if (typeof window !== "undefined") {
			return localStorage.getItem("selectedLanguage") || "fr";
		}
		return "fr";
	});
	const [availableLanguages, setAvailableLanguages] = useState<string[]>([]);
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

	// Save selected language to localStorage whenever it changes
	useEffect(() => {
		if (typeof window !== "undefined" && selectedLanguage) {
			localStorage.setItem("selectedLanguage", selectedLanguage);
		}
	}, [selectedLanguage]);

	// Scroll to bottom when messages change
	useEffect(() => {
		messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages]);

	// Call LLM API
	async function callLLM(
		lang: string,
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
					lang,
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
			const newMessages = await callLLM(selectedLanguage, inputText, messages);

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
		<div className="flex h-screen flex-col p-4">
			<div className="mb-4">
				<h1 className="font-bold text-xl">Proflasher Chat</h1>
				<div className="mt-2 flex gap-2">
					<select
						value={selectedLanguage}
						onChange={(e) => setSelectedLanguage(e.target.value)}
						className="rounded border p-2"
						disabled={isLoading}
					>
						{availableLanguages.map((lang) => (
							<option key={lang} value={lang}>
								{lang}
							</option>
						))}
					</select>
				</div>
			</div>

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
