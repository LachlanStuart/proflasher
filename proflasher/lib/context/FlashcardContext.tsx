'use client';

import { type ReactNode, createContext, useContext, useEffect, useMemo, useState } from 'react';
import templates from '../cardModel/noteTemplates';

interface FlashcardContextType {
    language: string;
    setLanguage: (lang: string) => void;
    activeCardTypes: string[];
    setActiveCardTypes: (types: string[]) => void;
    availableLanguages: string[];
    template: typeof templates[keyof typeof templates];
}

const FlashcardContext = createContext<FlashcardContextType | null>(null);

export function useFlashcard() {
    const context = useContext(FlashcardContext);
    if (!context) {
        throw new Error('useFlashcard must be used within a FlashcardProvider');
    }
    return context;
}

interface FlashcardProviderProps {
    children: ReactNode;
}

export function FlashcardProvider({ children }: FlashcardProviderProps) {
    // Initialize language from localStorage or default to 'fr'
    const [language, setLanguage] = useState<string>(() => {
        return localStorage.getItem('selectedLanguage') || 'fr';
    });

    // Save language to localStorage
    useEffect(() => {
        localStorage.setItem('selectedLanguage', language);
    }, [language]);


    // Get available languages
    const [availableLanguages, setAvailableLanguages] = useState<string[]>([]);

    // Fetch available languages on mount
    useEffect(() => {
        const fetchLanguages = async () => {
            const response = await fetch('/api/settings/languages');
            if (!response.ok) throw new Error('Failed to fetch languages');
            const data = await response.json();
            setAvailableLanguages(data);
            if (data.length > 0 && !data.includes(language)) {
                setLanguage(data[0]);
            }
        };

        fetchLanguages();
    }, []);

    const template = useMemo(() => templates[language]!, [language]);

    // Initialize active card types from localStorage or template defaults
    const [activeCardTypes, setActiveCardTypes] = useState<string[]>(() => {
        const saved = localStorage.getItem(`activeCardTypes_${language}`);
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch {
                return [];
            }
        }
        return Object.keys(template.cardDescriptions);
    });

    // Save active card types to localStorage
    useEffect(() => {
        localStorage.setItem(
            `activeCardTypes_${language}`,
            JSON.stringify(activeCardTypes)
        );
    }, [activeCardTypes, language]);


    const value = {
        language,
        setLanguage,
        activeCardTypes,
        setActiveCardTypes,
        availableLanguages,
        template,
    };

    return (
        <FlashcardContext.Provider value={value}>
            {children}
        </FlashcardContext.Provider>
    );
}
