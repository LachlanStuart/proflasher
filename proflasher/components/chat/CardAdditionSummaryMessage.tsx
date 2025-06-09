"use client";

import { useState } from "react";

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

interface CardAdditionSummaryMessageProps {
    message: CardAdditionSummaryType;
    onShowInAnki: (noteId: number) => void;
    onUpdate: (modelName: string, fields: Record<string, string>, activeCardTypes: string[], noteId: number) => void;
}

export function CardAdditionSummaryMessage({ message, onShowInAnki, onUpdate }: CardAdditionSummaryMessageProps) {
    const [showDetails, setShowDetails] = useState(false);

    const totalCards =
        message.successes.length + message.errors.length + message.duplicates.length + message.updates.length;
    const needsAction = message.errors.length + message.duplicates.length;

    // Generate summary text
    const getSummaryText = () => {
        const parts = [];
        if (message.successes.length > 0) {
            parts.push(`${message.successes.length} added`);
        }
        if (message.updates.length > 0) {
            parts.push(`${message.updates.length} updated`);
        }
        if (message.errors.length > 0) {
            parts.push(`${message.errors.length} failed`);
        }
        if (message.duplicates.length > 0) {
            parts.push(`${message.duplicates.length} duplicate${message.duplicates.length === 1 ? "" : "s"}`);
        }

        return parts.join(", ");
    };

    return (
        <div className="mb-4 flex">
            <div className="max-w-[95%] rounded-lg border-green-400 border-l-4 bg-green-50 px-4 py-2 text-gray-700">
                <div className="font-mono text-sm">
                    <div className="mb-1 font-bold text-green-600">
                        ✅ Added {totalCards} card{totalCards === 1 ? "" : "s"}
                        {needsAction > 0 && (
                            <span className="ml-2 text-orange-600">
                                ({needsAction} need{needsAction === 1 ? "s" : ""} action)
                            </span>
                        )}
                    </div>
                    <div className="mb-2">
                        <span className="text-gray-600">{getSummaryText()}</span>
                        {totalCards > 0 && (
                            <button
                                onClick={() => setShowDetails(!showDetails)}
                                className="ml-2 text-blue-500 text-xs hover:underline"
                            >
                                {showDetails ? "hide details" : "show details"}
                            </button>
                        )}
                    </div>

                    {showDetails && (
                        <div className="mt-2 space-y-3 border-gray-300 border-t pt-2">
                            {/* Successes */}
                            {message.successes.length > 0 && (
                                <div>
                                    <div className="mb-1 font-semibold text-green-600 text-xs">
                                        ✅ Successfully Added ({message.successes.length})
                                    </div>
                                    <div className="space-y-1">
                                        {message.successes.map((success, index) => (
                                            <div key={index} className="border-green-200 border-l-2 pl-2 text-xs">
                                                <span className="font-mono">#{success.noteId}</span> - {success.key}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Updates */}
                            {message.updates.length > 0 && (
                                <div>
                                    <div className="mb-1 font-semibold text-blue-600 text-xs">
                                        🔄 Updated ({message.updates.length})
                                    </div>
                                    <div className="space-y-1">
                                        {message.updates.map((update, index) => (
                                            <div key={index} className="border-blue-200 border-l-2 pl-2 text-xs">
                                                <span className="font-mono">#{update.noteId}</span> - {update.key}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Duplicates */}
                            {message.duplicates.length > 0 && (
                                <div>
                                    <div className="mb-1 font-semibold text-xs text-yellow-600">
                                        ⚠️ Duplicates Need Action ({message.duplicates.length})
                                    </div>
                                    <div className="space-y-2">
                                        {message.duplicates.map((duplicate, index) => (
                                            <div key={index} className="border-yellow-200 border-l-2 pl-2 text-xs">
                                                <div className="mb-1">
                                                    <span className="font-mono">#{duplicate.noteId}</span> -{" "}
                                                    {duplicate.key}
                                                </div>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => onShowInAnki(duplicate.noteId)}
                                                        className="rounded bg-blue-500 px-2 py-1 text-white text-xs hover:bg-blue-600"
                                                    >
                                                        Show in Anki
                                                    </button>
                                                    <button
                                                        onClick={() =>
                                                            onUpdate(
                                                                duplicate.modelName,
                                                                duplicate.fields,
                                                                duplicate.activeCardTypes,
                                                                duplicate.noteId,
                                                            )
                                                        }
                                                        className="rounded bg-green-500 px-2 py-1 text-white text-xs hover:bg-green-600"
                                                    >
                                                        Update
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Errors */}
                            {message.errors.length > 0 && (
                                <div>
                                    <div className="mb-1 font-semibold text-red-600 text-xs">
                                        ❌ Errors ({message.errors.length})
                                    </div>
                                    <div className="space-y-1">
                                        {message.errors.map((error, index) => (
                                            <div key={index} className="border-red-200 border-l-2 pl-2 text-xs">
                                                <div className="text-red-600">
                                                    {error.key}: {error.error}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
