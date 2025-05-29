import { useEffect, useState } from "react";

interface AnkiSearchMessageType {
    type: "anki_search";
    query: string;
    results: Array<Record<string, any>>;
    error?: string;
}

interface AnkiSearchMessageProps {
    message: AnkiSearchMessageType;
}

export function AnkiSearchMessage({ message }: AnkiSearchMessageProps) {
    const [showAllResults, setShowAllResults] = useState(false);

    // Maximum number of results to show initially
    const MAX_PREVIEW_RESULTS = 3;
    // Maximum number of fields to show per result
    const MAX_PREVIEW_FIELDS = 3;

    // Helper to truncate long values
    const truncateValue = (value: string, maxLength = 50) => {
        if (value.length <= maxLength) return value;
        return `${value.substring(0, maxLength)}...`;
    };

    // Get results to display
    const resultsToDisplay = showAllResults
        ? message.results
        : message.results.slice(0, MAX_PREVIEW_RESULTS);

    return (
        <div className="mb-4 flex">
            <div className="max-w-[80%] rounded-lg border-blue-400 border-l-4 bg-gray-100 px-4 py-2 text-gray-600">
                <div className="font-mono text-sm">
                    <div className="mb-1 font-bold text-blue-600">🔍 Anki Search</div>
                    <div className="mb-1">
                        Query: <span className="font-bold">{message.query}</span>
                    </div>
                    <div className="mb-2">
                        Found: <span className="font-bold">{message.results.length}</span>{" "}
                        results
                    </div>

                    {message.error && (
                        <div className="mt-2 text-red-500">Error: {message.error}</div>
                    )}

                    {resultsToDisplay.length > 0 && (
                        <div className="mt-2 border-gray-300 border-t pt-2">
                            {resultsToDisplay.map((result: any, index: number) => (
                                <div
                                    key={result.id || index}
                                    className="mb-2 border-gray-200 border-b pb-2 last:border-b-0"
                                >
                                    <div className="text-gray-500 text-xs">
                                        Card ID: {result.id}
                                    </div>
                                    {result.modelName && (
                                        <div className="text-gray-500 text-xs">
                                            Model: {result.modelName}
                                        </div>
                                    )}
                                    <div className="mt-1">
                                        <div className="text-xs">
                                            <span className="font-bold">Key:</span>{" "}
                                            {result.key}
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {message.results.length > MAX_PREVIEW_RESULTS &&
                                !showAllResults && (
                                    <button
                                        onClick={() => setShowAllResults(true)}
                                        className="mt-1 text-blue-500 text-xs hover:underline"
                                    >
                                        Show all {message.results.length} results
                                    </button>
                                )}

                            {showAllResults &&
                                message.results.length > MAX_PREVIEW_RESULTS && (
                                    <button
                                        onClick={() => setShowAllResults(false)}
                                        className="mt-1 text-blue-500 text-xs hover:underline"
                                    >
                                        Show fewer results
                                    </button>
                                )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
