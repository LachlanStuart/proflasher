"use client";

import { useState } from "react";

interface SyncButtonProps {
    className?: string;
}

export default function SyncButton({ className = "" }: SyncButtonProps) {
    // Sync button state
    const [syncState, setSyncState] = useState<"idle" | "syncing" | "success" | "error">("idle");
    const [syncMessage, setSyncMessage] = useState<string>("");

    // Sync button handler
    const handleSync = async () => {
        if (syncState === "syncing") return;

        setSyncState("syncing");
        setSyncMessage("");

        try {
            const response = await fetch("/api/anki/sync", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    options: {
                        updateCardModels: false,
                        addNoteTypes: false,
                        addDecks: false,
                        addCardTypes: false,
                        addFields: false,
                        syncToCloud: true,
                    },
                }),
            });

            const data = await response.json();

            if (response.ok && data.success) {
                setSyncState("success");
                setSyncMessage("Sync completed successfully");
            } else {
                setSyncState("error");
                // Extract error message from logs if available, otherwise use generic error or data.error
                let errorMessage = "Sync failed";
                if (data.logs && Array.isArray(data.logs)) {
                    // Find the first error message in logs (lines starting with ❌)
                    const errorLog = data.logs.find((log: string) => log.includes("❌"));
                    if (errorLog) {
                        errorMessage = errorLog;
                    }
                }
                if (data.error) {
                    errorMessage = data.error;
                }
                setSyncMessage(errorMessage);
            }
        } catch (error) {
            setSyncState("error");
            setSyncMessage(error instanceof Error ? error.message : "Network error");
        }

        // Reset state after 3 seconds
        setTimeout(() => {
            setSyncState("idle");
            setSyncMessage("");
        }, 3000);
    };

    // Sync button styles and content
    const getSyncButtonStyle = () => {
        const baseClasses = "px-3 py-1 rounded text-white transition-colors";
        const stateClasses = (() => {
            switch (syncState) {
                case "syncing":
                    return "bg-blue-600 opacity-70 cursor-not-allowed";
                case "success":
                    return "bg-green-600";
                case "error":
                    return "bg-red-600";
                default:
                    return "bg-gray-700 hover:bg-gray-800";
            }
        })();
        return `${baseClasses} ${stateClasses} ${className}`.trim();
    };

    const getSyncButtonText = () => {
        switch (syncState) {
            case "syncing":
                return "Syncing...";
            case "success":
                return "Success";
            case "error":
                return "Error";
            default:
                return "Sync Anki";
        }
    };

    return (
        <button
            onClick={handleSync}
            disabled={syncState === "syncing"}
            className={getSyncButtonStyle()}
            title={syncMessage || "Sync Anki to AnkiWeb"}
        >
            {getSyncButtonText()}
        </button>
    );
}
