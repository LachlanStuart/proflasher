"use client";

import { useCallback, useEffect, useState } from "react";
import { useFlashcard } from "~/lib/context/FlashcardContext";

export default function SettingsPage() {
    const [globalInstructions, setGlobalInstructions] = useState<string>("");
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [saveMessage, setSaveMessage] = useState<string | null>(null);
    const [ankiLogs, setAnkiLogs] = useState<string[]>([]);
    const [isUpdatingAnki, setIsUpdatingAnki] = useState<boolean>(false);
    const { language } = useFlashcard();

    // Fetch config files for the currently selected language
    const fetchConfigFiles = useCallback(async () => {
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
    }, [language]);

    // Setup effect to fetch config files when language changes
    useEffect(() => {
        fetchConfigFiles();
    }, [fetchConfigFiles]);

    // Handler for saving a config file
    const handleSaveFile = async (fileName: string, content: string) => {
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

    // Handler for updating Anki card models
    const handleUpdateAnkiModels = async (language?: string) => {
        setIsUpdatingAnki(true);
        setError(null);
        setAnkiLogs([]);
        try {
            const response = await fetch("/api/anki/update-models", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ language }),
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || "Failed to update Anki models");
            }
            setAnkiLogs(data.logs);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsUpdatingAnki(false);
        }
    };

    return (
        <div className="h-[calc(100vh-80px)] overflow-y-auto pb-4">
            {(isLoading || isSaving) && <p>Loading/Saving...</p>}
            {error && <p className="py-2 text-red-500">Error: {error}</p>}
            {saveMessage && <p className="py-2 text-green-500">{saveMessage}</p>}

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
                <div className="mt-2">
                    <button
                        onClick={() => handleSaveFile("prompt.md", globalInstructions)}
                        disabled={isSaving}
                        className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                    >
                        {isSaving ? "Saving..." : "Save Instructions"}
                    </button>
                </div>
            </div>

            <div className="mb-6">
                <h2 className="text-lg font-semibold mb-4">Anki</h2>
                <div className="space-y-4">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => handleUpdateAnkiModels(language)}
                            disabled={isUpdatingAnki}
                            className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                        >
                            {isUpdatingAnki ? "Updating..." : `Update card model for ${language.toUpperCase()}`}
                        </button>
                        <button
                            onClick={() => handleUpdateAnkiModels()}
                            disabled={isUpdatingAnki}
                            className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                        >
                            {isUpdatingAnki ? "Updating..." : "Update card models for all languages"}
                        </button>
                    </div>
                    {ankiLogs.length > 0 && (
                        <div className="mt-4 bg-gray-100 p-4 rounded-md">
                            <h3 className="font-medium mb-2">Update Log:</h3>
                            <pre className="text-sm whitespace-pre-wrap">
                                {ankiLogs.join("\n")}
                            </pre>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
