import React from "react";

interface UserMessageType {
	type: "user";
	content: string;
}

interface UserMessageProps {
	message: UserMessageType;
	onRewind?: () => void;
}

export function UserMessage({ message, onRewind }: UserMessageProps) {
	return (
		<div className="group mb-4 flex justify-end">
			<div className="relative max-w-[80%] whitespace-pre-line rounded-lg bg-blue-500 px-4 py-2 text-white">
				{message.content}
				{onRewind && (
					<button
						onClick={onRewind}
						className="-left-10 -translate-y-1/2 absolute top-1/2 flex h-8 w-8 transform items-center justify-center rounded-full bg-gray-500 text-sm text-white opacity-30 transition-opacity hover:bg-gray-600 group-hover:opacity-100"
						title="Rewind to this message"
					>
						↶
					</button>
				)}
			</div>
		</div>
	);
}
