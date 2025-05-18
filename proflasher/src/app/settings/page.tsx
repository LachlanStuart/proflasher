"use client";

import { useCallback, useEffect, useState } from "react";

export default function SettingsPage() {
    const [globalInstructions, setGlobalInstructions] = useState<string>("");
    const [confusedWords, setConfusedWords] = useState<string>("");
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [saveMessage, setSaveMessage] = useState<string | null>(null);

    // Get language from localStorage (it's managed in the Header component now)
    const getSelectedLanguage = () => {
        if (typeof window !== "undefined") {
            return localStorage.getItem("selectedLanguage") || "fr";
        }
        return "fr";
    };

    // Fetch config files for the currently selected language
    const fetchConfigFiles = useCallback(async () => {
        const language = getSelectedLanguage();
        if (!language) {
            setGlobalInstructions("");
            setConfusedWords("");
            return;
        }

        setIsLoading(true);
        setError(null);
        setSaveMessage(null);
        try {
            const filesToFetch = [
                { name: "global_llm_instructions.txt", setter: setGlobalInstructions },
                { name: "confused_words.txt", setter: setConfusedWords },
            ];
            for (const file of filesToFetch) {
                const response = await fetch(`/api/settings/${language}/${file.name}`);
                if (!response.ok) {
                    throw new Error(
                        `Failed to fetch ${file.name} for ${language}: ${response.statusText}`,
                    );
                }
                const data = await response.json();
                file.setter(data.content || "");
            }
        } catch (err: any) {
            setError(err.message);
            setGlobalInstructions(""); // Clear fields on error
            setConfusedWords("");
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Setup effect to listen for language changes in localStorage
    useEffect(() => {
        fetchConfigFiles();

        // Add event listener for storage changes
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === "selectedLanguage") {
                fetchConfigFiles();
            }
        };

        window.addEventListener("storage", handleStorageChange);
        return () => window.removeEventListener("storage", handleStorageChange);
    }, [fetchConfigFiles]);

    // Handler for saving a config file
    const handleSaveFile = async (fileName: string, content: string) => {
        const language = getSelectedLanguage();
        if (!language) {
            setError("No language selected.");
            return;
        }

        setIsSaving(true);
        setError(null);
        setSaveMessage(null);
        try {
            const response = await fetch(
                `/api/settings/${language}/${fileName}`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ content }),
                },
            );
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(
                    errData.error || `Failed to save ${fileName}: ${response.statusText}`,
                );
            }
            const result = await response.json();
            setSaveMessage(result.message || "File saved successfully!");
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsSaving(false);
            setTimeout(() => setSaveMessage(null), 3000); // Clear message after 3s
        }
    };

    const language = getSelectedLanguage();

    return (
        <div className="h-[calc(100vh-80px)] overflow-y-auto pb-4">
            {(isLoading || isSaving) && <p>Loading/Saving...</p>}
            {error && <p className="py-2 text-red-500">Error: {error}</p>}
            {saveMessage && <p className="py-2 text-green-500">{saveMessage}</p>}

            {language && (
                <>
                    <div className="mb-6">
                        <label
                            htmlFor="global-instructions"
                            className="block font-medium text-gray-700 text-sm"
                        >
                            Global LLM Instructions for {language.toUpperCase()}:
                        </label>
                        <textarea
                            id="global-instructions"
                            rows={10}
                            className="mt-1 block w-full rounded-md border-gray-300 p-2 shadow-sm sm:text-sm"
                            value={globalInstructions}
                            onChange={(e) => setGlobalInstructions(e.target.value)}
                            placeholder={`Enter global LLM instructions for ${language.toUpperCase()}...`}
                            disabled={isSaving}
                        />
                        <button
                            onClick={() =>
                                handleSaveFile(
                                    "global_llm_instructions.txt",
                                    globalInstructions,
                                )
                            }
                            disabled={isSaving}
                            className="mt-2 rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                        >
                            {isSaving ? "Saving..." : "Save Global Instructions"}
                        </button>
                    </div>

                    <div className="mb-6">
                        <label
                            htmlFor="confused-words"
                            className="block font-medium text-gray-700 text-sm"
                        >
                            Confused Words for {language.toUpperCase()} (one group per
                            line, words separated by commas):
                        </label>
                        <textarea
                            id="confused-words"
                            rows={5}
                            className="mt-1 block w-full rounded-md border-gray-300 p-2 shadow-sm sm:text-sm"
                            value={confusedWords}
                            onChange={(e) => setConfusedWords(e.target.value)}
                            placeholder={`Enter confused words for ${language.toUpperCase()}...`}
                            disabled={isSaving}
                        />
                        <button
                            onClick={() => handleSaveFile("confused_words.txt", confusedWords)}
                            disabled={isSaving}
                            className="mt-2 rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                        >
                            {isSaving ? "Saving..." : "Save Confused Words"}
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
