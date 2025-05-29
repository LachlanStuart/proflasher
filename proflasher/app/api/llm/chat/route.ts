import fs from "node:fs/promises";
import path from "node:path";
import { type NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { env } from "~/lib/env";
import { Anki } from "~/lib/ankiConnect";
import { validateNote, loadTemplates, type Templates } from "~/lib/cardModel/noteTemplates";
import { rowToColumnOriented, columnToRowOriented, type RowOrientedCard } from "~/lib/cardModel/tableCard";
import { generateTablePrompt } from "~/lib/llm/tablePrompts";

// Cache templates in memory to avoid reading from disk on every request
let templatesCache: Templates | null = null;
async function getTemplates(): Promise<Templates> {
    if (!templatesCache) {
        templatesCache = await loadTemplates();
    }
    return templatesCache;
}

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
            name: "messageToUser",
            description: "Display a message to the user. Always use this instead of returning text.",
            parameters: {
                type: "object",
                properties: {
                    message: {
                        type: "string",
                        description: "The message to send to the user",
                    },
                },
                required: ["message"],
            },
        },
    },
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
                        description: "An Anki search query",
                    },
                },
                required: ["query"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "proposeCards",
            description: "Propose new flashcards. The user will have the option to confirm or reject the cards, so don't ask before calling this.",
            parameters: {
                type: "object",
                properties: {
                    cards: {
                        type: "array",
                        description: "Array of card objects using table structure",
                        items: {
                            type: "object",
                            properties: {
                                fields: {
                                    type: "object",
                                    description: "Non-table fields like Key, Mnemonic, Related",
                                    additionalProperties: {
                                        type: "string",
                                    },
                                },
                                tables: {
                                    type: "object",
                                    description: "Table data organized by table name",
                                    additionalProperties: {
                                        type: "object",
                                        description: "Rows in this table",
                                        additionalProperties: {
                                            type: "object",
                                            description: "Column values for this row",
                                            additionalProperties: {
                                                type: "string",
                                            },
                                        },
                                    },
                                },
                            },
                            required: ["tables"],
                        },
                    },
                },
                required: ["cards"],
            },
        },
    },
] as const;

// Search Anki for cards
async function searchAnki(query: string): Promise<AnkiSearchMessage> {
    try {
        const cardIds = await Anki.findCards(query);
        const fullResults = cardIds.length > 0 ? await Anki.cardsInfo(cardIds) : [];

        // Simplify results to only show Key field to reduce verbosity
        const simplifiedResults = fullResults.map((card) => {
            const keyField = card.fields?.Key?.value;
            return {
                id: card.cardId,
                key: keyField,
                // Include model name if available
                ...(card.modelName && { modelName: card.modelName }),
            };
        });

        return {
            type: "anki_search",
            query,
            results: simplifiedResults,
        };
    } catch (error) {
        console.error("Error searching Anki:", error);
        return {
            type: "anki_search",
            query,
            results: [],
            error: String(error),
        };
    }
}

// Propose cards using table format
async function proposeCards(
    rowCards: RowOrientedCard[],
    lang: string,
): Promise<CardProposalMessage> {
    const templates = await getTemplates();
    const template = templates[lang];
    if (!template) throw new Error(`Template for language ${lang} not found`);

    // Convert row-oriented cards to column-oriented for validation and Anki
    const columnCards = rowCards.map(rowCard =>
        rowToColumnOriented(rowCard, template.tableDefinitions)
    );

    // Validate converted cards
    const invalidCards = await Promise.all(columnCards.map(async (card, index) => {
        const { isValid, error } = await validateNote(template.noteType, card, templates);
        return isValid ? [] : [`Card #${index + 1} has invalid fields: ${error}`];
    }));

    const allInvalidCards = invalidCards.flat();
    if (allInvalidCards.length > 0) {
        console.error("Invalid cards detected:", allInvalidCards);
        return {
            type: "card_proposal",
            cards: columnCards,
            error: `Invalid cards detected:\n${allInvalidCards.join("\n")}`,
        };
    }

    // Fill null fields with empty strings
    for (const card of columnCards) {
        for (const field of Object.keys(template.fieldDescriptions)) {
            if (!card[field]) {
                card[field] = "";
            }
        }
    }

    return {
        type: "card_proposal",
        cards: columnCards,
    };
}

// Build system instructions
async function buildSystemInstructions(lang: string): Promise<string> {
    const templates = await getTemplates();
    const template = templates[lang];
    if (!template) throw new Error(`Template for language ${lang} not found`);

    let systemPrompt = "";
    try {
        systemPrompt = await fs.readFile(
            path.join(env.DATA_REPO_PATH, lang, "prompt.md"),
            "utf-8",
        );
    } catch (error) {
        console.warn(`No system prompt found for language ${lang}, using default`);
        systemPrompt = `You are a language learning assistant helping create flashcards for ${template.language.toUpperCase()} language learning.`;
    }

    // Add table format information
    systemPrompt += "\n\n" + generateTablePrompt(template);

    // Add field descriptions
    systemPrompt += "\n\n## Field Descriptions\n\n";
    for (const [field, description] of Object.entries(template.fieldDescriptions)) {
        systemPrompt += `- **${field}**: ${description}\n`;
    }

    // Add required fields information
    systemPrompt += `\n\n## Required Fields\n\nThe following fields are required: ${template.requiredFields.join(", ")}\n`;

    // Add available card types
    systemPrompt += "\n\n## Available Card Types\n\n";
    for (const [type, description] of Object.entries(template.cardDescriptions)) {
        systemPrompt += `- **${type}**: ${description}\n`;
    }

    systemPrompt += "\n\n## Instructions\n\n";
    systemPrompt += "- Use the table format for better clarity and easier editing\n";
    systemPrompt += "- Focus on one row at a time when explaining or modifying cards\n";
    systemPrompt += "- Ensure each row contains related, complete information\n";
    systemPrompt += "- Use meaningful row names that reflect the content type\n";

    return systemPrompt;
}

// Convert conversation history to OpenAI format
function formatConversationHistory(
    history: ConversationMessage[],
): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
    return history.map((message) => {
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
                        ...(message.error && { error: message.error }),
                    }),
                };
            case "card_proposal":
                return {
                    role: "assistant",
                    content: JSON.stringify({
                        tool_call: "propose_cards",
                        cards: message.cards,
                        ...(message.error && { error: message.error }),
                    }),
                };
            default:
                return { role: "user", content: "" };
        }
    });
}

export async function POST(request: NextRequest) {
    try {
        const { lang, modelName, userPrompt, conversationHistory } =
            await request.json();

        if (!lang || !modelName || !userPrompt) {
            return NextResponse.json(
                [
                    ...conversationHistory,
                    { type: "user", content: userPrompt || "" } as UserMessage,
                    {
                        type: "error",
                        content: "Missing required fields: lang, modelName, or userPrompt",
                    } as ErrorMessage,
                ],
                { status: 400 },
            );
        }

        // Get language-specific prompt if conversation is new
        const fullPrompt = userPrompt;

        // Add user message to conversation
        const newHistory = [
            ...conversationHistory,
            { type: "user", content: fullPrompt } as UserMessage,
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

        return NextResponse.json(
            [
                ...conversationHistory,
                { type: "user", content: userPrompt } as UserMessage,
                {
                    type: "error",
                    content: `Server error: ${errorMessage}`,
                } as ErrorMessage,
            ],
            { status: 200 },
        ); // Send 200 status so client still processes the response
    }
}

// Helper function to call LLM with retry logic
async function callLLMWithRetry(
    lang: string,
    modelName: string,
    conversationHistory: ConversationMessage[],
): Promise<ConversationMessage[]> {
    let retryCount = 0;
    const newHistory: ConversationMessage[] = conversationHistory.slice();
    const openai = new OpenAI({
        apiKey: env.LLM_API_KEY,
        baseURL: env.LLM_API_BASE_URL,
    });
    while (true) {
        let completion: OpenAI.Chat.Completions.ChatCompletion;
        let responseMessage: OpenAI.Chat.Completions.ChatCompletionMessageParam | null =
            null;
        try {
            const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
                { role: "user", content: await buildSystemInstructions(lang) },
                ...formatConversationHistory(conversationHistory),
            ];
            completion = await openai.chat.completions.create({
                model: modelName,
                messages,
                tools: TOOLS,
                tool_choice: "auto",
            });
            console.log(
                `Prompt tokens: ${completion.usage?.prompt_tokens}, completion tokens: ${completion.usage?.completion_tokens}`,
            );

            if (completion.choices?.[0]?.message) {
                responseMessage = completion.choices[0].message;
            } else {
                throw new Error("No response received from LLM");
            }
            console.log('Request:', messages);
            console.log('Response:', responseMessage);

        } catch (error: any) {
            console.error("Error calling LLM:", error);
            if (retryCount++ >= 3) {
                newHistory.push({
                    type: "error",
                    content: `Error calling LLM: ${error.message ?? String(error)}`,
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

                    if (functionName === "messageToUser") {
                        newHistory.push({
                            type: "llm",
                            content: args.message,
                        } as LLMMessage);
                    } else if (functionName === "searchAnki") {
                        const searchResults = await searchAnki(args.query);
                        newHistory.push(searchResults);
                        isDone = false;
                    } else if (functionName === "proposeCards") {
                        const cardProposal = await proposeCards(
                            args.cards,
                            lang
                        );

                        newHistory.push(cardProposal);

                        if (cardProposal.error) {
                            isDone = retryCount++ >= 3;
                        }
                    } else {
                        throw new Error(`Unknown tool call: ${functionName}`);
                    }
                } catch (error: any) {
                    newHistory.push({
                        type: "error",
                        content: `Error processing ${functionName} tool call: ${error.message ?? String(error)}`,
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
                content: responseMessage.content,
            } as LLMMessage);
            return newHistory;
        } else {
            throw new Error("No response received from LLM");
        }
    }

    return conversationHistory;
}
