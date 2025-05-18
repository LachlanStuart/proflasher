import React from "react";

interface LLMMessageType {
	type: "llm";
	content: string;
}

interface LLMMessageProps {
	message: LLMMessageType;
}

export function LLMMessage({ message }: LLMMessageProps) {
	return (
		<div className="mb-4 flex">
			<div className="max-w-[80%] whitespace-pre-line rounded-lg bg-gray-200 px-4 py-2">
				{message.content}
			</div>
		</div>
	);
}
