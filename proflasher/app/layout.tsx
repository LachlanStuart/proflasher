import "~/app/globals.css";

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Header from "~/components/Header";
import { FlashcardProvider } from "~/lib/context/FlashcardContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "Proflasher",
    description: "AI-Powered Flashcard Generation",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    return (
        <html lang="en">
            <body className={inter.className}>
                <FlashcardProvider>
                    <div className="flex h-screen flex-col">
                        <div className="h-16 flex-shrink-0">
                            <Header />
                        </div>
                        <main className="flex flex-grow justify-center overflow-y-auto p-4">
                            <div className="w-full max-w-6xl">{children}</div>
                        </main>
                    </div>
                </FlashcardProvider>
            </body>
        </html>
    );
}
