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
        <div className="flex mb-4 justify-end">
            <div className="bg-blue-500 text-white px-4 py-2 rounded-lg max-w-[80%] whitespace-pre-line">
                {message.content}
            </div>
        </div>
    );
}
