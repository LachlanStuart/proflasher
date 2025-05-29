// Row-oriented card format types and utilities

export type RowValue = Record<string, string>; // e.g. {"EN": "word", "JP": "言葉"}

export type TableDefinition = {
    name: string;
    description: string;
    columns: string[]; // e.g. ["EN", "JP"] or ["FR", "EN"]
    rowDescriptions: Record<string, string>; // e.g. {"Word": "Dictionary form", "Sentence1": "Example sentence"}
};

export type RowOrientedCard = {
    tables: Record<string, Record<string, RowValue>>; // e.g. {"main": {"Word": {"EN": "word", "JP": "言葉"}}}
    fields: Record<string, string>; // Non-table fields like Key, Mnemonic, Related
};

export type ColumnOrientedCard = Record<string, string>; // Current Anki format

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

/**
 * Convert row-oriented card to column-oriented (Anki) format
 */
export function rowToColumnOriented(rowCard: RowOrientedCard, tableDefinitions: TableDefinition[]): ColumnOrientedCard {
    const result: ColumnOrientedCard = { ...rowCard.fields };

    // Build rowOrder for each table to track which rows are present
    const tableRowOrders: Record<string, string[]> = {};

    for (const tableDef of tableDefinitions) {
        const tableData = rowCard.tables[tableDef.name];
        if (!tableData) continue;

        const rowNames = Object.keys(tableData);
        const sortedRowNames = sortRowNames(rowNames, tableDef.rowDescriptions);
        tableRowOrders[tableDef.name] = sortedRowNames;

        // Build semicolon-separated values for each column
        for (const column of tableDef.columns) {
            const values = sortedRowNames.map(rowName => tableData[rowName]?.[column] || '');
            result[column] = values.join(';');
        }
    }

    // Add row order fields
    for (const [tableName, rowOrder] of Object.entries(tableRowOrders)) {
        const orderFieldName = tableName === 'main' ? 'RowOrder' : `${tableName.charAt(0).toUpperCase() + tableName.slice(1)}RowOrder`;
        result[orderFieldName] = rowOrder.join(';');
    }

    return result;
}

/**
 * Convert column-oriented (Anki) card to row-oriented format
 */
export function columnToRowOriented(columnCard: ColumnOrientedCard, tableDefinitions: TableDefinition[]): RowOrientedCard {
    const result: RowOrientedCard = {
        tables: {},
        fields: {}
    };

    // Extract table columns and row order fields
    const tableColumns = new Set<string>();
    const rowOrderFields = new Set<string>();

    for (const tableDef of tableDefinitions) {
        tableDef.columns.forEach(col => tableColumns.add(col));
        const orderFieldName = tableDef.name === 'main' ? 'RowOrder' : `${tableDef.name.charAt(0).toUpperCase() + tableDef.name.slice(1)}RowOrder`;
        rowOrderFields.add(orderFieldName);
    }

    // Separate table fields from non-table fields
    for (const [field, value] of Object.entries(columnCard)) {
        if (tableColumns.has(field) || rowOrderFields.has(field)) {
            // Skip - these are handled below
        } else {
            result.fields[field] = value;
        }
    }

    // Reconstruct tables
    for (const tableDef of tableDefinitions) {
        const orderFieldName = tableDef.name === 'main' ? 'RowOrder' : `${tableDef.name.charAt(0).toUpperCase() + tableDef.name.slice(1)}RowOrder`;
        const rowOrderValue = columnCard[orderFieldName];

        if (!rowOrderValue) continue;

        const rowNames = rowOrderValue.split(';').filter(name => name.trim());
        const tableData: Record<string, RowValue> = {};

        for (const column of tableDef.columns) {
            const columnValues = (columnCard[column] || '').split(';');

            for (let i = 0; i < rowNames.length; i++) {
                const rowName = rowNames[i]!;
                if (!tableData[rowName]) {
                    tableData[rowName] = {};
                }
                tableData[rowName]![column] = columnValues[i] || '';
            }
        }

        result.tables[tableDef.name] = tableData;
    }

    return result;
}

/**
 * Get all row names from a row-oriented card, organized by table, sorted according to rowDescriptions
 */
export function getRowNames(rowCard: RowOrientedCard, tableDefinitions: TableDefinition[]): Record<string, string[]> {
    const result: Record<string, string[]> = {};

    for (const [tableName, tableData] of Object.entries(rowCard.tables)) {
        const tableDef = tableDefinitions.find(t => t.name === tableName);
        const rowNames = Object.keys(tableData);

        if (tableDef) {
            result[tableName] = sortRowNames(rowNames, tableDef.rowDescriptions);
        } else {
            result[tableName] = rowNames; // fallback if no definition found
        }
    }

    return result;
}

/**
 * Add a new row to a table in a row-oriented card
 */
export function addRowToTable(
    rowCard: RowOrientedCard,
    tableName: string,
    rowName: string,
    rowData: RowValue
): RowOrientedCard {
    const updated = structuredClone(rowCard);

    if (!updated.tables[tableName]) {
        updated.tables[tableName] = {};
    }

    updated.tables[tableName]![rowName] = rowData;
    return updated;
}

/**
 * Remove a row from a table in a row-oriented card
 */
export function removeRowFromTable(
    rowCard: RowOrientedCard,
    tableName: string,
    rowName: string
): RowOrientedCard {
    const updated = structuredClone(rowCard);

    if (updated.tables[tableName]) {
        delete updated.tables[tableName]![rowName];

        // Remove table if empty
        if (Object.keys(updated.tables[tableName]!).length === 0) {
            delete updated.tables[tableName];
        }
    }

    return updated;
}

/**
 * Update a specific cell in a row-oriented card
 */
export function updateCell(
    rowCard: RowOrientedCard,
    tableName: string,
    rowName: string,
    column: string,
    value: string
): RowOrientedCard {
    const updated = structuredClone(rowCard);

    if (!updated.tables[tableName]) {
        updated.tables[tableName] = {};
    }

    if (!updated.tables[tableName]![rowName]) {
        updated.tables[tableName]![rowName] = {};
    }

    updated.tables[tableName]![rowName]![column] = value;
    return updated;
}
