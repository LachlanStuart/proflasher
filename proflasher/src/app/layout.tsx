import "~/styles/globals.css";

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
				<Header />
				<main className="container mx-auto p-4">{children}</main>
			</body>
		</html>
	);
}
