"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useFlashcard } from "~/lib/context/FlashcardContext";

export default function Header() {
    const pathname = usePathname();
    const { language, setLanguage, availableLanguages } = useFlashcard();

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
                                value={language}
                                onChange={(e) => setLanguage(e.target.value)}
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
