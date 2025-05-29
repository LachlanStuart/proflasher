"use client";

import { useState, useRef, useEffect } from "react";
import type { RowOrientedCard, TableDefinition, RowValue } from "~/lib/cardModel/tableCard";
import { updateCell, addRowToTable, removeRowFromTable } from "~/lib/cardModel/tableCard";

interface RowOrientedCardEditorProps {
    card: RowOrientedCard;
    tableDefinitions: TableDefinition[];
    onCardChange: (newCard: RowOrientedCard) => void;
    className?: string;
}

/**
 * Sort row names according to rowDescriptions order, with unrecognized rows at the end
 */
function sortRowNames(rowNames: string[], rowDescriptions: Record<string, string>): string[] {
    const orderedRowNames = Object.keys(rowDescriptions);
    const recognizedRows: string[] = [];
    const unrecognizedRows: string[] = [];

    for (const rowName of rowNames) {
        if (orderedRowNames.includes(rowName)) {
            recognizedRows.push(rowName);
        } else {
            unrecognizedRows.push(rowName);
        }
    }

    // Sort recognized rows according to their order in rowDescriptions
    recognizedRows.sort((a, b) => {
        const indexA = orderedRowNames.indexOf(a);
        const indexB = orderedRowNames.indexOf(b);
        return indexA - indexB;
    });

    // Return recognized rows first, then unrecognized rows
    return [...recognizedRows, ...unrecognizedRows];
}

export function RowOrientedCardEditor({
    card,
    tableDefinitions,
    onCardChange,
    className = ""
}: RowOrientedCardEditorProps) {
    const textareaRefs = useRef<{ [key: string]: HTMLTextAreaElement | null }>({});

    // Auto-resize textareas on content change
    const resizeTextarea = (textarea: HTMLTextAreaElement) => {
        if (!textarea) return;

        // Reset height to measure scrollHeight correctly
        textarea.style.height = "auto";

        // Calculate new height (with a maximum of 4 rows)
        const lineHeight = Number.parseInt(getComputedStyle(textarea).lineHeight) || 20;
        const maxHeight = lineHeight * 4;
        const newHeight = Math.min(textarea.scrollHeight, maxHeight);

        textarea.style.height = `${newHeight}px`;
        textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden";
    };

    // Handle cell changes
    const handleCellChange = (tableName: string, rowName: string, column: string, value: string) => {
        const updatedCard = updateCell(card, tableName, rowName, column, value);
        onCardChange(updatedCard);

        // Resize the textarea after content change
        setTimeout(() => {
            const key = `${tableName}-${rowName}-${column}`;
            if (textareaRefs.current[key]) {
                resizeTextarea(textareaRefs.current[key]!);
            }
        }, 0);
    };

    // Handle row name changes
    const handleRowNameChange = (tableName: string, oldRowName: string, newRowName: string) => {
        if (oldRowName === newRowName || !newRowName.trim()) return;

        const updatedCard = { ...card };
        const tableData = updatedCard.tables[tableName];
        if (tableData && tableData[oldRowName]) {
            // Copy the row data to the new name
            tableData[newRowName] = { ...tableData[oldRowName] };
            // Delete the old row
            delete tableData[oldRowName];
            onCardChange(updatedCard);
        }
    };

    // Handle field changes (non-table fields)
    const handleFieldChange = (field: string, value: string) => {
        const updatedCard = {
            ...card,
            fields: {
                ...card.fields,
                [field]: value
            }
        };
        onCardChange(updatedCard);

        // Resize the textarea after content change
        setTimeout(() => {
            const key = `field-${field}`;
            if (textareaRefs.current[key]) {
                resizeTextarea(textareaRefs.current[key]!);
            }
        }, 0);
    };

    // Move row up or down
    const moveRow = (tableName: string, rowName: string, direction: 'up' | 'down') => {
        const tableData = card.tables[tableName] || {};
        const currentRowNames = Object.keys(tableData);

        const currentIndex = currentRowNames.indexOf(rowName);
        if (currentIndex === -1) return;

        const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
        if (newIndex < 0 || newIndex >= currentRowNames.length) return;

        // Create new order by swapping positions
        const newOrder = [...currentRowNames];
        [newOrder[currentIndex], newOrder[newIndex]] = [newOrder[newIndex]!, newOrder[currentIndex]!];

        // Rebuild the table data in the new order
        const newTableData: Record<string, RowValue> = {};
        for (const name of newOrder) {
            newTableData[name] = tableData[name]!;
        }

        const updatedCard = {
            ...card,
            tables: {
                ...card.tables,
                [tableName]: newTableData
            }
        };
        onCardChange(updatedCard);
    };

    // Add a new row to a table
    const handleAddRow = (tableName: string) => {
        const tableDef = tableDefinitions.find(t => t.name === tableName);
        if (!tableDef) return;

        const existingRows = Object.keys(card.tables[tableName] || {});
        const rowCount = existingRows.length;

        // Generate a new row name based on existing pattern or default to numbered rows
        let newRowName = `Row${rowCount + 1}`;
        if (existingRows.some(name => name.startsWith('Sentence'))) {
            newRowName = `Sentence${rowCount + 1}`;
        } else if (existingRows.some(name => name.startsWith('Example'))) {
            newRowName = `Example${rowCount + 1}`;
        } else if (existingRows.some(name => name.startsWith('Context'))) {
            newRowName = `Context${rowCount + 1}`;
        } else if (existingRows.some(name => name.startsWith('Form'))) {
            newRowName = `Form${rowCount + 1}`;
        }

        // Create empty row data
        const newRowData: RowValue = {};
        for (const column of tableDef.columns) {
            newRowData[column] = '';
        }

        const updatedCard = addRowToTable(card, tableName, newRowName, newRowData);
        onCardChange(updatedCard);
    };

    // Remove a row from a table
    const handleRemoveRow = (tableName: string, rowName: string) => {
        const updatedCard = removeRowFromTable(card, tableName, rowName);
        onCardChange(updatedCard);
    };

    // Initialize textarea heights
    useEffect(() => {
        Object.values(textareaRefs.current).forEach((textarea) => {
            if (textarea) resizeTextarea(textarea);
        });
    }, [card]);

    return (
        <div className={`space-y-4 ${className}`}>
            {/* Non-table fields - responsive layout */}
            {Object.keys(card.fields).length > 0 && (
                <div>
                    <h3 className="font-semibold mb-2 text-gray-700">Card Fields</h3>
                    <div className="grid gap-2">
                        {(() => {
                            // Sort field entries based on the order in tableDefinitions field descriptions
                            const allFieldDescriptions = new Set<string>();

                            // Collect all field descriptions to establish order
                            tableDefinitions.forEach(tableDef => {
                                Object.keys(tableDef.rowDescriptions || {}).forEach(field => allFieldDescriptions.add(field));
                            });

                            // Get common field order: Key first, then others alphabetically, Mnemonic and Related last
                            const fieldOrder = ['Key', ...Object.keys(card.fields).filter(f => !['Key', 'Mnemonic', 'Related'].includes(f)).sort(), 'Mnemonic', 'Related'];

                            // Filter to only fields that actually exist and maintain order
                            const orderedFields = fieldOrder.filter(field => card.fields.hasOwnProperty(field));

                            return orderedFields.map(field => (
                                <div key={field} className="flex flex-wrap items-center gap-3 min-w-0">
                                    <label className="font-medium text-gray-600 text-sm min-w-20 flex-shrink-0">
                                        {field}:
                                    </label>
                                    <textarea
                                        ref={(el) => {
                                            textareaRefs.current[`field-${field}`] = el;
                                        }}
                                        value={card.fields[field]}
                                        onChange={(e) => handleFieldChange(field, e.target.value)}
                                        className="overflow-hidden rounded border border-gray-300 p-1 text-sm flex-1 min-w-0"
                                        style={{ minWidth: '50%' }}
                                        onInput={(e) => resizeTextarea(e.target as HTMLTextAreaElement)}
                                        rows={1}
                                        placeholder={`Enter ${field}...`}
                                    />
                                </div>
                            ));
                        })()}
                    </div>
                </div>
            )}

            {/* Tables */}
            {tableDefinitions.map((tableDef) => {
                const tableData = card.tables[tableDef.name] || {};
                const rowNames = sortRowNames(Object.keys(tableData), tableDef.rowDescriptions);

                return (
                    <div key={tableDef.name}>
                        <div className="flex items-center justify-between mb-2">
                            <div>
                                <h3 className="font-semibold text-gray-700 capitalize">
                                    {tableDef.name === 'main' ? 'Main Table' : `${tableDef.name} Table`}
                                </h3>
                                <p className="text-sm text-gray-500">{tableDef.description}</p>
                            </div>
                            <button
                                onClick={() => handleAddRow(tableDef.name)}
                                className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                            >
                                + Add Row
                            </button>
                        </div>

                        {rowNames.length === 0 ? (
                            <div className="border border-gray-200 rounded p-4 text-center text-gray-500">
                                No rows yet. Click "Add Row" to get started.
                            </div>
                        ) : (
                            <div className="border border-gray-200 rounded overflow-hidden">
                                <table className="w-full">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-2 text-center text-sm font-medium text-gray-700 border-r w-20">
                                                Actions
                                            </th>
                                            <th className="px-2 text-left text-sm font-medium text-gray-700 border-r" style={{ width: '88px' }}>
                                                Row
                                            </th>
                                            {tableDef.columns.map((column) => (
                                                <th key={column} className="px-2 text-left text-sm font-medium text-gray-700 border-r last:border-r-0">
                                                    {column}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rowNames.map((rowName, index) => (
                                            <tr key={rowName} className="border-t">
                                                <td className="px-2 text-center border-r">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <button
                                                            onClick={() => moveRow(tableDef.name, rowName, 'up')}
                                                            disabled={index === 0}
                                                            className="text-blue-500 hover:text-blue-700 text-xs disabled:text-gray-300 w-4 h-4 flex items-center justify-center"
                                                            title="Move up"
                                                        >
                                                            ↑
                                                        </button>
                                                        <button
                                                            onClick={() => moveRow(tableDef.name, rowName, 'down')}
                                                            disabled={index === rowNames.length - 1}
                                                            className="text-blue-500 hover:text-blue-700 text-xs disabled:text-gray-300 w-4 h-4 flex items-center justify-center"
                                                            title="Move down"
                                                        >
                                                            ↓
                                                        </button>
                                                        <button
                                                            onClick={() => handleRemoveRow(tableDef.name, rowName)}
                                                            className="text-red-500 hover:text-red-700 text-xs w-4 h-4 flex items-center justify-center"
                                                            title="Remove row"
                                                        >
                                                            ×
                                                        </button>
                                                    </div>
                                                </td>
                                                <td className="px-2 text-sm border-r bg-gray-50 min-w-0" style={{ width: '88px' }}>
                                                    <input
                                                        type="text"
                                                        value={rowName}
                                                        onChange={(e) => handleRowNameChange(tableDef.name, rowName, e.target.value)}
                                                        className="w-full bg-transparent border-0 p-0 text-sm font-medium text-gray-600 focus:ring-1 focus:ring-blue-500 rounded"
                                                        title={tableDef.rowDescriptions[rowName] || rowName}
                                                    />
                                                </td>
                                                {tableDef.columns.map((column) => (
                                                    <td key={column} className="px-2 border-r last:border-r-0">
                                                        <textarea
                                                            ref={(el) => {
                                                                textareaRefs.current[`${tableDef.name}-${rowName}-${column}`] = el;
                                                            }}
                                                            value={tableData[rowName]?.[column] || ''}
                                                            onChange={(e) => handleCellChange(tableDef.name, rowName, column, e.target.value)}
                                                            className="w-full overflow-hidden resize-none border-0 p-1 text-sm focus:ring-1 focus:ring-blue-500 rounded"
                                                            onInput={(e) => resizeTextarea(e.target as HTMLTextAreaElement)}
                                                            rows={1}
                                                            placeholder={`${column}...`}
                                                        />
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
