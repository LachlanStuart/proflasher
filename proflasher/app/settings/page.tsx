"use client";

import { useCallback, useEffect, useState } from "react";

export default function SettingsPage() {
    const [globalInstructions, setGlobalInstructions] = useState<string>("");
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
            return;
        }

        setIsLoading(true);
        setError(null);
        setSaveMessage(null);
        try {
            const response = await fetch(`/api/settings/${language}/prompt.md`);
            if (!response.ok) {
                throw new Error(
                    `Failed to fetch prompt.md for ${language}: ${response.statusText}`,
                );
            }
            const data = await response.json();
            setGlobalInstructions(data.content || "");
        } catch (err: any) {
            setError(err.message);
            setGlobalInstructions(""); // Clear fields on error
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

            {language && (
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
                    <div className="mt-2 flex items-center gap-4">
                        <button
                            onClick={() =>
                                handleSaveFile(
                                    "prompt.md",
                                    globalInstructions
                                )
                            }
                            disabled={isSaving}
                            className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                        >
                            {isSaving ? "Saving..." : "Save"}
                        </button>
                        {isLoading && <p>Loading...</p>}
                        {isSaving && <p>Saving...</p>}
                        {error && <p className="text-red-500">Error: {error}</p>}
                        {saveMessage && <p className="text-green-500">{saveMessage}</p>}
                    </div>
                </div>
            )}
        </div>
    );
}
