import Link from "next/link";

export default function Header() {
	return (
		<header className="bg-gray-800 p-4 text-white">
			<nav className="container mx-auto flex justify-between">
				<Link href="/" className="font-bold text-xl hover:text-gray-300">
					Proflasher
				</Link>
				<ul className="flex space-x-4">
					<li>
						<Link href="/" className="hover:text-gray-300">
							Home
						</Link>
					</li>
					<li>
						<Link href="/chat" className="hover:text-gray-300">
							Chat
						</Link>
					</li>
					<li>
						<Link href="/settings" className="hover:text-gray-300">
							Settings
						</Link>
					</li>
					{/* Add more links as needed */}
				</ul>
			</nav>
		</header>
	);
}
