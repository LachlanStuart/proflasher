import fs from "node:fs/promises";
import path from "node:path";
import { type NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { Anki } from "~/lib/ankiConnect";
import { type Templates, loadTemplates, validateNote } from "~/lib/cardModel/noteTemplates";
import { type RowOrientedCard, columnToRowOriented, rowToColumnOriented } from "~/lib/cardModel/tableCard";
import { env } from "~/lib/env";
import { generateTablePrompt } from "~/lib/llm/tablePrompts";

async function getTemplates(): Promise<Templates> {
    return await loadTemplates(); // Don't cache. User may edit the templates live.
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
    toolCallId: string;
}

interface CardProposalMessage {
    type: "card_proposal";
    cards: RowOrientedCard[];
    error?: string;
    message?: string;
    toolCallId: string;
}

interface GetNotesMessage {
    type: "get_notes";
    keys: string[];
    noteInfos: Record<string, any> | null;
    error?: string;
    toolCallId: string;
}

type ConversationMessage =
    | UserMessage
    | LLMMessage
    | ErrorMessage
    | AnkiSearchMessage
    | CardProposalMessage
    | GetNotesMessage;

const TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
    {
        type: "function",
        function: {
            name: "searchAnki",
            description: `Search for existing cards in Anki. Only use this if the user asks you to check existing cards.
The search will automatically be scoped to the current language's note type.
Example queries:
- Marked cards: "tag:marked"
- Cards that the user has had difficulty with: "prop:lapses>4"
- Active cards that the user has seen many times: "prop:reps>15 -is:suspended"
- Cards containing the word "beyond": "beyond" (searches without a colon are free text search)
- List all cards: "" (empty string query)
`,
            parameters: {
                type: "object",
                properties: {
                    query: {
                        type: "string",
                        description: "An Anki search query (note type will be automatically added)",
                    },
                },
                required: ["query"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "getNotes",
            description:
                "Get detailed information about one or more specific notes by their Key field. This retrieves all fields from the note including metadata.",
            parameters: {
                type: "object",
                properties: {
                    keys: {
                        type: "array",
                        description: "The Key field values of the notes to retrieve",
                        items: {
                            type: "string",
                            description: "The Key field value of the note to retrieve",
                        },
                    },
                },
                required: ["keys"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "proposeCards",
            description:
                "Propose new flashcards or replacements for existing flashcards (overwritten by Key). " +
                "The user will have the option to confirm or reject the cards, so don't ask before calling this.",
            parameters: {
                type: "object",
                properties: {
                    cards: {
                        type: "array",
                        description: "Array of card objects",
                        items: {
                            type: "object",
                            properties: {
                                fields: {
                                    type: "object",
                                    description: "Non-table fields like Key, UsageNotes, Related",
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
                    message: {
                        type: "string",
                        description: "Message to show to the user after proposing the cards",
                    },
                },
                required: ["cards", "message"],
            },
        },
    },
] as const;

// Search Anki for cards
async function searchAnki(query: string, lang: string, toolCallId: string): Promise<AnkiSearchMessage> {
    try {
        // Get the note type for the current language
        const templates = await getTemplates();
        const noteType = templates[lang]?.noteType;

        // Prepend note type to the query if it exists
        const finalQuery = noteType ? `note:${noteType} ${query}` : query;

        const noteIds = await Anki.findNotes(finalQuery);
        const fullResults = noteIds.length > 0 ? await Anki.notesInfo(noteIds) : [];

        // Simplify results to only show Key field to reduce verbosity
        const simplifiedResults = fullResults.map((note) => {
            const keyField = note.fields?.Key?.value;
            return { Key: keyField };
        });

        return {
            type: "anki_search",
            query: finalQuery,
            results: simplifiedResults,
            toolCallId,
        };
    } catch (error) {
        console.error("Error searching Anki:", error);
        return {
            type: "anki_search",
            query,
            results: [],
            error: String(error),
            toolCallId,
        };
    }
}

// Get detailed note information by Key field
async function getNotes(keys: string[], lang: string, toolCallId: string): Promise<GetNotesMessage> {
    try {
        // Get the note type for the current language
        const templates = await getTemplates();
        const noteType = templates[lang]?.noteType ?? "";

        // Search for notes with the specific Key field value
        const noteIdsByKey = await Promise.all(
            keys.map(async (key) => [key, await Anki.findNotes(`note:${noteType} Key:${key}`)]),
        );

        const noteInfos = [];
        for (const [key, noteIds] of noteIdsByKey) {
            if (!noteIds || noteIds.length === 0) {
                noteInfos.push({
                    key,
                    error: `No note found with Key: ${key}`,
                });
            } else {
                const noteInfo = await Anki.notesInfo([noteIds[0]! as number]);
                noteInfos.push(noteInfo);
            }
        }

        return {
            type: "get_notes",
            keys,
            noteInfos,
            toolCallId,
        };
    } catch (error) {
        console.error("Error getting note:", error);
        return {
            type: "get_notes",
            keys,
            noteInfos: null,
            error: String(error),
            toolCallId,
        };
    }
}

// Propose cards using table format
async function proposeCards(
    rowCards: RowOrientedCard[],
    lang: string,
    toolCallId: string,
    message?: string,
): Promise<CardProposalMessage> {
    const templates = await getTemplates();
    const template = templates[lang];
    if (!template) throw new Error(`Template for language ${lang} not found`);

    // Basic validation of row cards structure
    const invalidCards: string[] = [];
    for (const [index, rowCard] of rowCards.entries()) {
        // Determine which tables actually contain required fields
        const tableColumns = new Set<string>();
        const requiredTableNames = new Set<string>();

        for (const tableDef of template.tableDefinitions) {
            tableDef.columns.forEach((col) => tableColumns.add(col));

            // Check if this table contains any required fields
            const hasRequiredColumns = tableDef.columns.some((col) => template.requiredFields.includes(col));
            if (hasRequiredColumns) {
                requiredTableNames.add(tableDef.name);
            }
        }

        // Check that tables containing required fields exist and have data
        for (const tableName of requiredTableNames) {
            if (!rowCard.tables[tableName] || Object.keys(rowCard.tables[tableName]).length === 0) {
                invalidCards.push(`Card #${index + 1}: Missing required table '${tableName}'`);
            }
        }

        // Check that required non-table fields exist if they're not table columns
        for (const requiredField of template.requiredFields) {
            if (!tableColumns.has(requiredField) && !rowCard.fields?.[requiredField]) {
                invalidCards.push(`Card #${index + 1}: Missing required field '${requiredField}'`);
            }
        }
    }

    if (invalidCards.length > 0) {
        console.error("Invalid cards detected:", invalidCards);
        return {
            type: "card_proposal",
            cards: rowCards,
            error: `Invalid cards detected:\n${invalidCards.join("\n")}`,
            toolCallId,
        };
    }

    // Fill in missing optional fields with empty strings
    const processedCards = rowCards.map((card) => {
        const processedCard = { ...card };

        // Ensure all non-table fields exist
        const tableColumns = new Set<string>();
        for (const tableDef of template.tableDefinitions) {
            tableDef.columns.forEach((col) => tableColumns.add(col));
        }

        // Initialize fields object if it doesn't exist
        if (!processedCard.fields) {
            processedCard.fields = {};
        }

        // Add empty strings for missing non-table fields from fieldDescriptions
        for (const field of Object.keys(template.fieldDescriptions)) {
            if (!tableColumns.has(field) && !processedCard.fields[field]) {
                processedCard.fields[field] = "";
            }
        }

        return processedCard;
    });

    return {
        type: "card_proposal",
        cards: processedCards,
        message,
        toolCallId,
    };
}

// Build system instructions
async function buildSystemInstructions(lang: string): Promise<string> {
    const templates = await getTemplates();
    const template = templates[lang];
    if (!template) throw new Error(`Template for language ${lang} not found`);

    let systemPrompt = "";
    try {
        systemPrompt = await fs.readFile(path.join(env.DATA_REPO_PATH, lang, "prompt.md"), "utf-8");
    } catch (error) {
        console.warn(`No system prompt found for language ${lang}, using default`);
        systemPrompt = `You are a language learning assistant helping create flashcards for ${template.language.toUpperCase()} language learning.`;
    }

    // Add table format information
    systemPrompt += `\n\n${generateTablePrompt(template)}`;

    // Add field descriptions for non-table fields only
    const tableColumns = new Set<string>();
    for (const tableDef of template.tableDefinitions) {
        tableDef.columns.forEach((col) => tableColumns.add(col));
    }

    const nonTableFields = Object.entries(template.fieldDescriptions).filter(([field]) => !tableColumns.has(field));

    if (nonTableFields.length > 0) {
        systemPrompt += "\n\n## Non-Table Fields\n\n";
        for (const [field, description] of nonTableFields) {
            systemPrompt += `- **${field}**: ${description}\n`;
        }
    }

    // Add required fields information
    systemPrompt += `\n\n## Required Fields\n\nThe following fields are required: ${template.requiredFields.join(", ")}\n`;

    systemPrompt += "End of system prompt. User's request will follow.";

    return systemPrompt;
}

// Convert conversation history to OpenAI format
function formatConversationHistory(
    history: ConversationMessage[],
): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
    const result: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

    for (const message of history) {
        if (message.type === "user") {
            result.push({ role: "user", content: message.content });
        } else if (message.type === "llm") {
            result.push({ role: "assistant", content: message.content });
        } else if (message.type === "error") {
            // Skip error messages when sending to LLM
            result.push({
                role: "user",
                content: `Previous error: ${message.content}`,
            });
        } else if (message.type === "anki_search") {
            result.push({
                role: "assistant",
                // content: null,
                tool_calls: [
                    {
                        id: message.toolCallId,
                        type: "function" as const,
                        function: {
                            name: "searchAnki",
                            arguments: JSON.stringify({ query: message.query }),
                        },
                    },
                ],
            });
            result.push({
                role: "tool",
                tool_call_id: message.toolCallId,
                content: JSON.stringify({
                    results: message.results,
                    ...(message.error && { error: message.error }),
                }),
            });
        } else if (message.type === "card_proposal") {
            result.push({
                role: "assistant",
                // content: null,
                tool_calls: [
                    {
                        id: message.toolCallId,
                        type: "function" as const,
                        function: {
                            name: "proposeCards",
                            arguments: JSON.stringify({ cards: message.cards }),
                        },
                    },
                ],
            });
            result.push({
                role: "tool",
                tool_call_id: message.toolCallId,
                content: JSON.stringify(message.error ? { error: message.error } : { result: "Cards proposed." }),
            });
        } else if (message.type === "get_notes") {
            result.push({
                role: "assistant",
                // content: null,
                tool_calls: [
                    {
                        id: message.toolCallId,
                        type: "function" as const,
                        function: {
                            name: "getNotes",
                            arguments: JSON.stringify({ keys: message.keys }),
                        },
                    },
                ],
            });
            result.push({
                role: "tool",
                tool_call_id: message.toolCallId,
                content: JSON.stringify(message),
            });
        } else {
            result.push({ role: "user", content: "" });
        }
    }

    return result;
}

export async function POST(request: NextRequest) {
    try {
        const { lang, modelName, userPrompt, conversationHistory } = await request.json();

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
        const newHistory = [...conversationHistory, { type: "user", content: fullPrompt } as UserMessage];

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
        let responseMessage: OpenAI.Chat.Completions.ChatCompletionMessageParam | null = null;
        try {
            const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
                { role: "user", content: await buildSystemInstructions(lang) },
                ...formatConversationHistory(newHistory),
            ];
            console.log("Request:", messages);

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
            console.log("Response:", responseMessage);
        } catch (error: any) {
            console.error("Error calling LLM:");
            console.error(error);
            console.error(error.headers);
            if (retryCount++ >= 3) {
                newHistory.push({
                    type: "error",
                    content: `Error calling LLM: ${error.message ?? String(error)}`,
                } as ErrorMessage);
                return newHistory;
            }
            continue;
        }

        let messageContent: string | null = null;
        let toolCalls: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[] = [];

        if (responseMessage.content) {
            let contentStr: string;
            // Handle both string and array content types
            if (typeof responseMessage.content === "string") {
                contentStr = responseMessage.content.trim();
            } else {
                // If it's an array, join the text parts
                contentStr = responseMessage.content
                    .filter((part) => part.type === "text")
                    .map((part) => (part as any).text)
                    .join("")
                    .trim();
            }
            // Check if the content looks like a JSON tool call that wasn't properly handled
            if (contentStr.startsWith('{"tool_call":')) {
                try {
                    console.log(`Detected JSON in content: ${contentStr.substring(0, 100)}...`);
                    toolCalls = JSON.parse(contentStr);
                } catch (parseError: any) {
                    console.log("Content is not JSON tool call, treating as regular message");
                    messageContent = contentStr;
                }
            } else {
                messageContent = contentStr;
            }
        }
        if (responseMessage.tool_calls) {
            toolCalls = responseMessage.tool_calls;
        }
        if (!messageContent && toolCalls.length === 0) {
            console.log("No message content or tool calls, returning");
            return newHistory;
        }
        console.log({ messageContent, toolCalls });

        let isDone = true;
        if (messageContent) {
            // Regular content message
            newHistory.push({
                type: "llm",
                content: messageContent,
            } as LLMMessage);
        }
        if (toolCalls.length > 0) {
            for (const toolCall of toolCalls) {
                const extraContent = (toolCall as any).extra_content;
                const functionName = toolCall.function.name;
                const args = JSON.parse(toolCall.function.arguments);
                console.log(functionName, args, extraContent);
                try {
                    if (functionName === "searchAnki") {
                        const searchResults = await searchAnki(args.query, lang, toolCall.id || "0");
                        newHistory.push(searchResults);
                        isDone = false;
                    } else if (functionName === "getNotes") {
                        const noteResult = await getNotes(args.keys, lang, toolCall.id || "0");
                        newHistory.push(noteResult);
                        isDone = false;
                    } else if (functionName === "proposeCards") {
                        const cardProposal = await proposeCards(args.cards, lang, toolCall.id || "0", args.message);

                        newHistory.push(cardProposal);

                        // If there's a message, add it as a separate assistant message
                        if (cardProposal.message) {
                            newHistory.push({
                                type: "llm",
                                content: cardProposal.message,
                            } as LLMMessage);
                        }
                        isDone = !cardProposal.error || retryCount++ >= 3;
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
        }
        if (isDone) {
            return newHistory;
        }
    }

    return conversationHistory;
}
