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
        <div className="mb-4 flex justify-end group">
            <div className="max-w-[80%] whitespace-pre-line rounded-lg bg-blue-500 px-4 py-2 text-white relative">
                {message.content}
                {onRewind && (
                    <button
                        onClick={onRewind}
                        className="absolute -left-10 top-1/2 transform -translate-y-1/2 opacity-30 group-hover:opacity-100 transition-opacity bg-gray-500 hover:bg-gray-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm"
                        title="Rewind to this message"
                    >
                        ↶
                    </button>
                )}
            </div>
        </div>
    );
}
