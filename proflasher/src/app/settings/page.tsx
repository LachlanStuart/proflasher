"use client";

import { useCallback, useEffect, useState } from "react";

export default function SettingsPage() {
	const [availableLanguages, setAvailableLanguages] = useState<string[]>([]);
	const [selectedLanguage, setSelectedLanguage] = useState<string | null>(null);
	const [globalInstructions, setGlobalInstructions] = useState<string>("");
	const [confusedWords, setConfusedWords] = useState<string>("");
	const [isLoading, setIsLoading] = useState<boolean>(false);
	const [isSaving, setIsSaving] = useState<boolean>(false);
	const [error, setError] = useState<string | null>(null);
	const [saveMessage, setSaveMessage] = useState<string | null>(null);

	// Fetch available languages on mount
	useEffect(() => {
		const fetchLanguages = async () => {
			setIsLoading(true);
			setError(null);
			try {
				const response = await fetch("/api/settings/languages");
				if (!response.ok) {
					throw new Error(`Failed to fetch languages: ${response.statusText}`);
				}
				const data = await response.json();
				setAvailableLanguages(data);
				if (data.length > 0 && !selectedLanguage) {
					setSelectedLanguage(data[0]); // Select the first language by default only if none is selected
				}
			} catch (err: any) {
				setError(err.message);
			} finally {
				setIsLoading(false);
			}
		};
		fetchLanguages();
	}, [selectedLanguage]); // Re-run if selectedLanguage changes, to ensure it s valid

	// Fetch config files when selectedLanguage changes
	const fetchConfigFiles = useCallback(async (language: string | null) => {
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

	useEffect(() => {
		if (selectedLanguage) {
			fetchConfigFiles(selectedLanguage);
		}
	}, [selectedLanguage, fetchConfigFiles]);

	// Handler for saving a config file
	const handleSaveFile = async (fileName: string, content: string) => {
		if (!selectedLanguage) {
			setError("No language selected.");
			return;
		}
		setIsSaving(true);
		setError(null);
		setSaveMessage(null);
		try {
			const response = await fetch(
				`/api/settings/${selectedLanguage}/${fileName}`,
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
			// Optionally re-fetch to confirm or trust the save
			// fetchConfigFiles(selectedLanguage);
		} catch (err: any) {
			setError(err.message);
		} finally {
			setIsSaving(false);
			setTimeout(() => setSaveMessage(null), 3000); // Clear message after 3s
		}
	};

	return (
		<div className="container mx-auto p-4">
			<h1 className="mb-4 font-bold text-2xl">Settings</h1>

			{(isLoading || isSaving) && <p>Loading/Saving...</p>}
			{error && <p className="py-2 text-red-500">Error: {error}</p>}
			{saveMessage && <p className="py-2 text-green-500">{saveMessage}</p>}

			<div className="mb-6">
				<label
					htmlFor="language-select"
					className="mb-1 block font-medium text-gray-700 text-sm"
				>
					Select Language:
				</label>
				<select
					id="language-select"
					value={selectedLanguage || ""}
					onChange={(e) => {
						setSelectedLanguage(e.target.value);
						// Clear previous language's data immediately
						setGlobalInstructions("");
						setConfusedWords("");
					}}
					className="mt-1 block w-full rounded-md border-gray-300 py-2 pr-10 pl-3 text-base focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
					disabled={isLoading || isSaving || availableLanguages.length === 0}
				>
					<option value="" disabled>
						{availableLanguages.length === 0
							? "No languages found"
							: "Select a language"}
					</option>
					{availableLanguages.map((lang) => (
						<option key={lang} value={lang}>
							{lang.toUpperCase()}
						</option>
					))}
				</select>
			</div>

			{selectedLanguage && (
				<>
					<div className="mb-6">
						<label
							htmlFor="global-instructions"
							className="block font-medium text-gray-700 text-sm"
						>
							Global LLM Instructions for {selectedLanguage.toUpperCase()}:
						</label>
						<textarea
							id="global-instructions"
							rows={10}
							className="mt-1 block w-full rounded-md border-gray-300 p-2 shadow-sm sm:text-sm"
							value={globalInstructions}
							onChange={(e) => setGlobalInstructions(e.target.value)}
							placeholder={`Enter global LLM instructions for ${selectedLanguage.toUpperCase()}...`}
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
							Confused Words for {selectedLanguage.toUpperCase()} (one group per
							line, words separated by commas):
						</label>
						<textarea
							id="confused-words"
							rows={5}
							className="mt-1 block w-full rounded-md border-gray-300 p-2 shadow-sm sm:text-sm"
							value={confusedWords}
							onChange={(e) => setConfusedWords(e.target.value)}
							placeholder={
								"Example: word1,word1_alt\nword2,word2_alt,word2_variant"
							}
							disabled={isSaving}
						/>
						<button
							onClick={() =>
								handleSaveFile("confused_words.txt", confusedWords)
							}
							disabled={isSaving}
							className="mt-2 rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
						>
							{isSaving ? "Saving..." : "Save Confused Words"}
						</button>
					</div>
				</>
			)}
			{/* TODO: Corpora Management Section */}
		</div>
	);
}
