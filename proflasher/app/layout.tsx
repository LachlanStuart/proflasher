import "~/app/globals.css";

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Header from "~/components/Header";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "Proflasher",
    description: "AI-Powered Flashcard Generation",
};

export default function RootLayout({
    children,
}: Readonly<{ children: React.ReactNode }>) {
    return (
        <html lang="en">
            <body className={inter.className}>
                <div className="flex flex-col h-screen">
                    <div className="h-16 flex-shrink-0">
                        <Header />
                    </div>
                    <main className="flex-grow overflow-hidden p-4 flex justify-center">
                        <div className="w-full max-w-6xl">
                            {children}
                        </div>
                    </main>
                </div>
            </body>
        </html>
    );
}
