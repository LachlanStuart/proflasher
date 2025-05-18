import { ErrorMessage as ErrorMessageType } from "~/app/chat/page";

interface ErrorMessageProps {
    message: ErrorMessageType;
}

export function ErrorMessage({ message }: ErrorMessageProps) {
    return (
        <div className="flex mb-4">
            <div className="bg-red-100 text-red-700 px-4 py-2 rounded-lg max-w-[80%] border-l-4 border-red-500">
                <div className="font-bold mb-1">⚠️ Error</div>
                {message.content}
            </div>
        </div>
    );
}
