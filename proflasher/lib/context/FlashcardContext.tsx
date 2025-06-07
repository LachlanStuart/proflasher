"use client";

import {
	type ReactNode,
	createContext,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";
import type {
	ProcessedNoteTemplate,
	Templates,
} from "../cardModel/noteTemplates";

interface FlashcardContextType {
	language: string;
	setLanguage: (lang: string) => void;
	activeCardTypes: string[];
	setActiveCardTypes: (types: string[]) => void;
	availableLanguages: string[];
	template: ProcessedNoteTemplate;
	templates: Templates;
}

const FlashcardContext = createContext<FlashcardContextType | null>(null);

export function useFlashcard() {
	const context = useContext(FlashcardContext);
	if (!context) {
		throw new Error("useFlashcard must be used within a FlashcardProvider");
	}
	return context;
}

interface FlashcardProviderProps {
	children: ReactNode;
}

export function FlashcardProvider({ children }: FlashcardProviderProps) {
	// Initialize language from localStorage or default to 'fr'
	const [language, setLanguage] = useState<string>(() => {
		if (typeof window === "undefined") return "fr";
		return localStorage.getItem("selectedLanguage") || "fr";
	});

	// Save language to localStorage
	useEffect(() => {
		if (typeof window === "undefined") return;
		localStorage.setItem("selectedLanguage", language);
	}, [language]);

	// Get available languages and templates
	const [availableLanguages, setAvailableLanguages] = useState<string[]>([]);
	const [templates, setTemplates] = useState<Templates>({});

	// Fetch available languages and templates on mount
	// biome-ignore lint/correctness/useExhaustiveDependencies(language): Should only run on initial load
	useEffect(() => {
		const fetchLanguages = async () => {
			const response = await fetch("/api/settings/languages");
			if (!response.ok) throw new Error("Failed to fetch languages");
			const data = await response.json();
			setAvailableLanguages(data.languages);
			setTemplates(data.templates);
			if (data.languages.length > 0 && !data.languages.includes(language)) {
				setLanguage(data.languages[0]);
			}
		};

		fetchLanguages();
	}, []);

	const template = useMemo(() => templates[language], [templates, language]);

	// Initialize active card types from localStorage or template defaults
	const [activeCardTypes, setActiveCardTypes] = useState<string[]>(() => {
		if (typeof window === "undefined") return [];
		const saved = localStorage.getItem(`activeCardTypes_${language}`);
		if (saved) {
			try {
				return JSON.parse(saved);
			} catch {
				return [];
			}
		}
		return template ? Object.keys(template.cardDescriptions) : [];
	});

	// Save active card types to localStorage
	useEffect(() => {
		if (typeof window === "undefined") return;
		localStorage.setItem(
			`activeCardTypes_${language}`,
			JSON.stringify(activeCardTypes),
		);
	}, [activeCardTypes, language]);

	// Don't render until we have templates loaded
	if (!template) {
		return null;
	}

	const value = {
		language,
		setLanguage,
		activeCardTypes,
		setActiveCardTypes,
		availableLanguages,
		template,
		templates,
	};

	return (
		<FlashcardContext.Provider value={value}>
			{children}
		</FlashcardContext.Provider>
	);
}
