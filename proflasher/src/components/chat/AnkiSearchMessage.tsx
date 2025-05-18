import { useState, useEffect } from "react";
import { AnkiSearchMessage as AnkiSearchMessageType } from "~/app/chat/page";

interface AnkiSearchMessageProps {
    message: AnkiSearchMessageType;
}

export function AnkiSearchMessage({ message }: AnkiSearchMessageProps) {
    const [showAnalyzing, setShowAnalyzing] = useState(true);
    const [showAllResults, setShowAllResults] = useState(false);

    // Maximum number of results to show initially
    const MAX_PREVIEW_RESULTS = 3;
    // Maximum number of fields to show per result
    const MAX_PREVIEW_FIELDS = 3;

    // Hide the "analyzing" message after 5 seconds
    useEffect(() => {
        const timer = setTimeout(() => {
            setShowAnalyzing(false);
        }, 5000);

        return () => clearTimeout(timer);
    }, []);

    // Helper to truncate long values
    const truncateValue = (value: string, maxLength = 50) => {
        if (value.length <= maxLength) return value;
        return value.substring(0, maxLength) + '...';
    };

    // Get results to display
    const resultsToDisplay = showAllResults
        ? message.results
        : message.results.slice(0, MAX_PREVIEW_RESULTS);

    return (
        <div className="flex mb-4">
            <div className="bg-gray-100 px-4 py-2 rounded-lg max-w-[80%] text-gray-600 border-l-4 border-blue-400">
                <div className="font-mono text-sm">
                    <div className="font-bold text-blue-600 mb-1">🔍 Anki Search</div>
                    <div className="mb-1">Query: <span className="font-bold">{message.query}</span></div>
                    <div className="mb-2">Found: <span className="font-bold">{message.results.length}</span> results</div>

                    {message.error && (
                        <div className="mt-2 text-red-500">Error: {message.error}</div>
                    )}

                    {resultsToDisplay.length > 0 && (
                        <div className="mt-2 border-t border-gray-300 pt-2">
                            {resultsToDisplay.map((result, index) => (
                                <div key={result.id || index} className="mb-2 pb-2 border-b border-gray-200 last:border-b-0">
                                    <div className="text-xs text-gray-500">Card ID: {result.id}</div>
                                    {result.modelName && (
                                        <div className="text-xs text-gray-500">Model: {result.modelName}</div>
                                    )}
                                    <div className="mt-1">
                                        {Object.entries(result.fields || {})
                                            .slice(0, MAX_PREVIEW_FIELDS)
                                            .map(([field, value]) => (
                                                <div key={field} className="text-xs">
                                                    <span className="font-bold">{field}:</span> {truncateValue(value)}
                                                </div>
                                            ))}

                                        {Object.keys(result.fields || {}).length > MAX_PREVIEW_FIELDS && (
                                            <div className="text-xs text-gray-400 italic">
                                                +{Object.keys(result.fields).length - MAX_PREVIEW_FIELDS} more fields
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}

                            {message.results.length > MAX_PREVIEW_RESULTS && !showAllResults && (
                                <button
                                    onClick={() => setShowAllResults(true)}
                                    className="text-xs text-blue-500 hover:underline mt-1"
                                >
                                    Show all {message.results.length} results
                                </button>
                            )}

                            {showAllResults && message.results.length > MAX_PREVIEW_RESULTS && (
                                <button
                                    onClick={() => setShowAllResults(false)}
                                    className="text-xs text-blue-500 hover:underline mt-1"
                                >
                                    Show fewer results
                                </button>
                            )}
                        </div>
                    )}

                    {showAnalyzing && message.results.length > 0 && !message.error && (
                        <div className="mt-2 italic text-blue-500">
                            The assistant is analyzing these results...
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
