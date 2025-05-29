interface ErrorMessageType {
    type: "error";
    content: string;
}

interface ErrorMessageProps {
    message: ErrorMessageType;
}

export function ErrorMessage({ message }: ErrorMessageProps) {
    return (
        <div className="mb-4 flex">
            <div className="max-w-[80%] rounded-lg border-red-500 border-l-4 bg-red-100 px-4 py-2 text-red-700">
                <div className="mb-1 font-bold">⚠️ Error</div>
                {message.content}
            </div>
        </div>
    );
}
