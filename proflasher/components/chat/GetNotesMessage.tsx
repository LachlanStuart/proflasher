"use client";

import { useState } from "react";

interface GetNotesMessageType {
	type: "get_notes";
	keys: string[];
	noteInfos: any[] | null;
	error?: string;
}

interface GetNotesMessageProps {
	message: GetNotesMessageType;
}

export function GetNotesMessage({ message }: GetNotesMessageProps) {
	const [showAllFields, setShowAllFields] = useState<Record<number, boolean>>(
		{},
	);
	const [expandedNotes, setExpandedNotes] = useState<Record<number, boolean>>(
		{},
	);

	// Maximum number of fields to show initially
	const MAX_PREVIEW_FIELDS = 5;

	// Helper to truncate long values
	const truncateValue = (value: string, maxLength = 100) => {
		if (value.length <= maxLength) return value;
		return `${value.substring(0, maxLength)}...`;
	};

	const toggleFieldsView = (noteIndex: number) => {
		setShowAllFields((prev) => ({
			...prev,
			[noteIndex]: !prev[noteIndex],
		}));
	};

	const toggleNoteExpansion = (noteIndex: number) => {
		setExpandedNotes((prev) => ({
			...prev,
			[noteIndex]: !prev[noteIndex],
		}));
	};

	// Helper to render a single note
	const renderNote = (noteInfo: any, key: string, index: number) => {
		const isExpanded = expandedNotes[index];
		const showAllFieldsForNote = showAllFields[index];

		// Handle error case
		if (noteInfo.error) {
			return (
				<div
					key={index}
					className="mb-3 border-gray-200 border-b last:border-b-0"
				>
					<div className="mb-1">
						<span className="font-bold text-gray-700">Key:</span> {key}
					</div>
					<div className="text-red-500 text-sm">Error: {noteInfo.error}</div>
				</div>
			);
		}

		// Handle successful note retrieval
		if (!noteInfo || !noteInfo[0]) {
			return (
				<div
					key={index}
					className="mb-3 border-gray-200 border-b last:border-b-0"
				>
					<div className="mb-1">
						<span className="font-bold text-gray-700">Key:</span> {key}
					</div>
					<div className="text-red-500 text-sm">No note data available</div>
				</div>
			);
		}

		const note = noteInfo[0];
		const fieldEntries = note.fields ? Object.entries(note.fields) : [];

		return (
			<div
				key={index}
				className="mb-3 border-gray-200 border-b last:border-b-0"
			>
				<div className="mb-2 flex items-center justify-between">
					<div>
						<span className="font-bold text-gray-700">Key:</span> {key}
					</div>
					{fieldEntries.length > 0 && (
						<button
							onClick={() => toggleNoteExpansion(index)}
							className="text-purple-500 text-xs hover:underline"
						>
							{isExpanded ? "Collapse" : "Expand"}
						</button>
					)}
				</div>

				{isExpanded && (
					<>
						<div className="mb-2 text-gray-500 text-xs">
							<div>Note ID: {note.noteId}</div>
							<div>Model: {note.modelName}</div>
							{note.tags && note.tags.length > 0 && (
								<div>Tags: [{note.tags.join(", ")}]</div>
							)}
						</div>

						{fieldEntries.length > 0 && (
							<div className="mt-2">
								<div className="mb-1 font-semibold text-gray-700 text-sm">
									Fields:
								</div>
								{fieldEntries
									.slice(
										0,
										showAllFieldsForNote ? undefined : MAX_PREVIEW_FIELDS,
									)
									.map(([fieldName, fieldData]: [string, any]) => (
										<div
											key={fieldName}
											className="mb-1 border-gray-200 border-b pb-1 last:border-b-0"
										>
											<div className="text-xs">
												<span className="font-bold text-gray-700">
													{fieldName}:
												</span>{" "}
												<span className="text-gray-600">
													{typeof fieldData?.value === "string"
														? truncateValue(fieldData.value)
														: JSON.stringify(fieldData)}
												</span>
											</div>
										</div>
									))}

								{fieldEntries.length > MAX_PREVIEW_FIELDS && (
									<div className="mt-2">
										{!showAllFieldsForNote ? (
											<button
												onClick={() => toggleFieldsView(index)}
												className="text-purple-500 text-xs hover:underline"
											>
												Show all {fieldEntries.length} fields
											</button>
										) : (
											<button
												onClick={() => toggleFieldsView(index)}
												className="text-purple-500 text-xs hover:underline"
											>
												Show fewer fields
											</button>
										)}
									</div>
								)}
							</div>
						)}
					</>
				)}
			</div>
		);
	};

	return (
		<div className="mb-4 flex">
			<div className="max-w-[80%] rounded-lg border-purple-400 border-l-4 bg-gray-100 px-4 py-2 text-gray-600">
				<div className="font-mono text-sm">
					<div className="mb-1 font-bold text-purple-600">
						📝 Searched for {message.keys.length} note
						{message.keys.length !== 1 ? "s" : ""}
					</div>

					{message.error && (
						<div className="mt-2 text-red-500">Error: {message.error}</div>
					)}

					{Array.isArray(message.noteInfos) && (
						<div className="mt-2 border-gray-300 border-t pt-2">
							{message.keys.map((key, index) =>
								renderNote(message.noteInfos![index], key, index),
							)}
						</div>
					)}

					{!Array.isArray(message.noteInfos) && !message.error && (
						<div className="mt-2 text-gray-500">
							No note information available
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
