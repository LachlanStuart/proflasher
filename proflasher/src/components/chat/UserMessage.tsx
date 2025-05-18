import React from "react";

interface UserMessageType {
	type: "user";
	content: string;
}

interface UserMessageProps {
	message: UserMessageType;
}

export function UserMessage({ message }: UserMessageProps) {
	return (
		<div className="mb-4 flex justify-end">
			<div className="max-w-[80%] whitespace-pre-line rounded-lg bg-blue-500 px-4 py-2 text-white">
				{message.content}
			</div>
		</div>
	);
}
