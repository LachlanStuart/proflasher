"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export default function Header() {
    const pathname = usePathname();
    const [availableLanguages, setAvailableLanguages] = useState<string[]>([]);
    const [selectedLanguage, setSelectedLanguage] = useState<string>(() => {
        if (typeof window !== "undefined") {
            return localStorage.getItem("selectedLanguage") || "fr";
        }
        return "fr";
    });

    // Fetch available languages
    useEffect(() => {
        const fetchLanguages = async () => {
            try {
                const response = await fetch("/api/settings/languages");
                if (!response.ok) throw new Error("Failed to fetch languages");
                const data = await response.json();
                setAvailableLanguages(data);
                if (data.length > 0 && !data.includes(selectedLanguage)) {
                    setSelectedLanguage(data[0]);
                }
            } catch (error) {
                console.error("Error fetching languages:", error);
            }
        };

        fetchLanguages();
    }, []);

    // Save selected language to localStorage
    useEffect(() => {
        if (typeof window !== "undefined" && selectedLanguage) {
            localStorage.setItem("selectedLanguage", selectedLanguage);
        }
    }, [selectedLanguage]);

    // Active link style
    const activeLinkClass = "text-white bg-gray-700 px-3 py-1 rounded";
    const inactiveLinkClass = "text-gray-300 hover:text-white px-3 py-1";

    return (
        <header className="bg-gray-800 p-4 text-white">
            <div className="flex justify-center">
                <div className="w-full max-w-6xl">
                    <nav className="flex justify-between items-center">
                        <Link href="/chat" className="font-bold text-xl hover:text-gray-300">
                            Proflasher
                        </Link>
                        <div className="flex items-center space-x-4">
                            <select
                                value={selectedLanguage}
                                onChange={(e) => setSelectedLanguage(e.target.value)}
                                className="bg-gray-700 text-white px-3 py-1 rounded"
                            >
                                {availableLanguages.map((lang) => (
                                    <option key={lang} value={lang}>
                                        {lang.toUpperCase()}
                                    </option>
                                ))}
                            </select>
                            <ul className="flex space-x-2">
                                <li>
                                    <Link
                                        href="/chat"
                                        className={pathname === "/chat" || pathname === "/" ? activeLinkClass : inactiveLinkClass}
                                    >
                                        Chat
                                    </Link>
                                </li>
                                <li>
                                    <Link
                                        href="/settings"
                                        className={pathname === "/settings" ? activeLinkClass : inactiveLinkClass}
                                    >
                                        Settings
                                    </Link>
                                </li>
                            </ul>
                        </div>
                    </nav>
                </div>
            </div>
        </header>
    );
}
