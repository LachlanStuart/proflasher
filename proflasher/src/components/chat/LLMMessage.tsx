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
        <div className="flex mb-4">
            <div className="bg-gray-200 px-4 py-2 rounded-lg max-w-[80%] whitespace-pre-line">
                {message.content}
            </div>
        </div>
    );
}
