import fs from "node:fs/promises";
import path from "node:path";
import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import { env } from "~/env";
import { Anki } from "~/lib/ankiConnect";
import templates, { validateNote } from "~/lib/cardModel/noteTemplates";

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

const TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
    {
        type: "function",
        function: {
            name: "searchAnki",
            description: `Search for existing cards in Anki. Only use this if the user asks you to check existing cards.
If you use this, make sure to limit the note type specific to the current language, by prefixing the query with one of these:
- "note:ZH<->EN " for Chinese
- "note:FR<->EN " for French
- "note:JP<->EN " for Japanese
- "note:DE<->EN " for German`,
            parameters: {
                type: "object",
                properties: {
                    query: {
                        type: "string",
                        description: "An Anki search query"
                    }
                },
                required: ["query"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "proposeCards",
            description: "Propose new flashcards to create",
            parameters: {
                type: "object",
                properties: {
                    cards: {
                        type: "array",
                        description: "Array of card objects with fields matching the template",
                        items: {
                            type: "object",
                            additionalProperties: {
                                type: "string"
                            }
                        }
                    }
                },
                required: ["cards"]
            }
        }
    }
] as const;


// Search Anki for cards
async function searchAnki(query: string): Promise<AnkiSearchMessage> {
    try {
        const cardIds = await Anki.findCards(query);
        const fullResults = cardIds.length > 0 ? await Anki.cardsInfo(cardIds) : [];

        // Simplify results to reduce verbosity
        const simplifiedResults = fullResults.map(card => {
            // Extract just the card ID and field values
            const simplifiedFields: Record<string, string> = {};

            // Convert fields from {fieldName: {value: "xyz", order: 1}} to {fieldName: "xyz"}
            if (card.fields) {
                Object.entries(card.fields).forEach(([fieldName, fieldData]) => {
                    if (typeof fieldData === 'object' && fieldData !== null && 'value' in fieldData) {
                        // Only include non-empty fields
                        const value = fieldData.value as string;
                        if (value && value.trim() !== '') {
                            simplifiedFields[fieldName] = value;
                        }
                    }
                });
            }

            return {
                id: card.cardId,
                fields: simplifiedFields,
                // Include model name if available
                ...(card.modelName && { modelName: card.modelName })
            };
        });

        return {
            type: "anki_search",
            query,
            results: simplifiedResults
        };
    } catch (error) {
        console.error("Error searching Anki:", error);
        return {
            type: "anki_search",
            query,
            results: [],
            error: String(error)
        };
    }
}

// Propose cards to create or update with validation
function proposeCards(cards: Array<Record<string, string>>, lang: string): CardProposalMessage {
    const template = templates[lang];
    if (!template) throw new Error(`Template for language ${lang} not found`);

    // Validate cards
    const invalidCards = cards.flatMap((card, index) => {
        const { isValid, error } = validateNote(lang, card);
        return isValid ? [] : [`Card #${index + 1} has invalid fields: ${error}`];
    });

    if (invalidCards.length > 0) {
        console.error(`Invalid cards detected:`, invalidCards);
        return {
            type: "card_proposal",
            cards,
            error: `Invalid cards detected:\n${invalidCards.join("\n")}`
        };
    }
    // Fill null fields with empty strings
    for (const card of cards) {
        for (const field of Object.keys(template.fieldDescriptions)) {
            if (!card[field]) {
                card[field] = "";
            }
        }
    }

    return {
        type: "card_proposal",
        cards: cards
    };
}

// Build system instructions
async function buildSystemInstructions(lang: string): Promise<string> {
    const template = templates[lang];
    if (!template) throw new Error(`Template for language ${lang} not found`);

    return await fs.readFile(path.join(env.DATA_REPO_PATH, lang, "prompt.md"), "utf-8");
}


// Convert conversation history to OpenAI format
function formatConversationHistory(
    history: ConversationMessage[]
): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
    return history.map(message => {
        switch (message.type) {
            case "user":
                return { role: "user", content: message.content };
            case "llm":
                return { role: "assistant", content: message.content };
            case "error":
                // Skip error messages when sending to LLM
                return { role: "user", content: `Previous error: ${message.content}` };
            case "anki_search":
                return {
                    role: "assistant",
                    content: JSON.stringify({
                        tool_call: "anki_search",
                        query: message.query,
                        results: message.results,
                        ...(message.error && { error: message.error })
                    })
                };
            case "card_proposal":
                return {
                    role: "assistant",
                    content: JSON.stringify({
                        tool_call: "propose_cards",
                        cards: message.cards,
                        ...(message.error && { error: message.error })
                    })
                };
            default:
                return { role: "user", content: "" };
        }
    });
}

export async function POST(request: NextRequest) {
    try {
        const { lang, modelName, userPrompt, conversationHistory } = await request.json();

        if (!lang || !modelName || !userPrompt) {
            return NextResponse.json([
                ...conversationHistory,
                { type: "user", content: userPrompt || "" } as UserMessage,
                { type: "error", content: "Missing required fields: lang, modelName, or userPrompt" } as ErrorMessage
            ], { status: 400 });
        }

        // Get language-specific prompt if conversation is new
        let fullPrompt = userPrompt;

        // Add user message to conversation
        const newHistory = [
            ...conversationHistory,
            { type: "user", content: fullPrompt } as UserMessage
        ];

        const result = await callLLMWithRetry(lang, modelName, newHistory);
        return NextResponse.json(result);
    } catch (error) {
        console.error("Error in LLM chat API:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);

        // Return the conversation with an error message
        const history = request.body ? await request.json().catch(() => ({})) : {};
        const conversationHistory = history.conversationHistory || [];
        const userPrompt = history.userPrompt || "";

        return NextResponse.json([
            ...conversationHistory,
            { type: "user", content: userPrompt } as UserMessage,
            { type: "error", content: `Server error: ${errorMessage}` } as ErrorMessage
        ], { status: 200 }); // Send 200 status so client still processes the response
    }
}

// Helper function to call LLM with retry logic
async function callLLMWithRetry(
    lang: string,
    modelName: string,
    conversationHistory: ConversationMessage[]
): Promise<ConversationMessage[]> {
    let retryCount = 0;
    const newHistory: ConversationMessage[] = conversationHistory.slice();
    const openai = new OpenAI({
        apiKey: env.LLM_API_KEY,
        baseURL: env.LLM_API_BASE_URL
    });
    while (true) {
        let completion: OpenAI.Chat.Completions.ChatCompletion;
        let responseMessage: OpenAI.Chat.Completions.ChatCompletionMessageParam | null = null;
        try {
            const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
                { role: "user", content: await buildSystemInstructions(lang) },
                ...formatConversationHistory(conversationHistory)
            ];
            completion = await openai.chat.completions.create({
                model: modelName,
                messages,
                tools: TOOLS,
                tool_choice: "auto"
            });
            console.log(`Prompt tokens: ${completion.usage?.prompt_tokens}, completion tokens: ${completion.usage?.completion_tokens}`);

            if (completion.choices?.[0]?.message) {
                responseMessage = completion.choices[0].message;
            } else {
                throw new Error("No response received from LLM");
            }
        } catch (error: any) {
            console.error("Error calling LLM:", error);
            if (retryCount++ >= 3) {
                newHistory.push({
                    type: "error",
                    content: `Error calling LLM: ${error.message ?? String(error)}`
                } as ErrorMessage);
                return newHistory;
            }
            continue;
        }

        // Process response
        if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
            console.log("Tool call. Message?", responseMessage.content);
            let isDone = true;
            for (const toolCall of responseMessage.tool_calls) {
                const functionName = toolCall.function.name;
                try {
                    const args = JSON.parse(toolCall.function.arguments);
                    console.log(functionName, args);

                    if (functionName === "searchAnki") {
                        const searchResults = await searchAnki(args.query);
                        newHistory.push(searchResults);
                        isDone = false;
                    } else if (functionName === "proposeCards") {
                        const cardProposal = proposeCards(args.cards, lang);
                        newHistory.push(cardProposal);
                        if (cardProposal.error) {
                            isDone = false;
                        }
                    } else {
                        throw new Error(`Unknown tool call: ${functionName}`);
                    }
                } catch (error: any) {
                    newHistory.push({
                        type: "error",
                        content: `Error processing ${functionName} tool call: ${error.message ?? String(error)}`
                    } as ErrorMessage);
                    if (retryCount++ >= 3) {
                        isDone = true;
                    }
                }
            }
            if (isDone) return newHistory;
        } else if (responseMessage.content) {
            newHistory.push({
                type: "llm",
                content: responseMessage.content
            } as LLMMessage);
            return newHistory;
        } else {
            throw new Error("No response received from LLM");
        }
    }

    return conversationHistory;
}
