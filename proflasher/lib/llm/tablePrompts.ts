import type { ProcessedNoteTemplate } from "../cardModel/noteTemplates";
import type { TableDefinition } from "../cardModel/tableCard";

/**
 * Generate a prompt section describing the table structure for the LLM
 */
export function generateTableStructurePrompt(tableDefinitions: TableDefinition[]): string {
    let prompt = "## Card Structure\n\n";

    if (tableDefinitions.length === 1) {
        const table = tableDefinitions[0]!;
        prompt += "Cards contain a table with the following structure:\n\n";
        prompt += `**Purpose**: ${table.description}\n\n`;

        // Add column descriptions
        prompt += "**Columns**:\n";
        for (const column of table.columns) {
            const description = table.columnDescriptions?.[column] || `${column} language content`;
            prompt += `- **${column}**: ${description}\n`;
        }
        prompt += "\n";

        if (Object.keys(table.rowDescriptions).length > 0) {
            prompt += "**Row types and their purposes**:\n";
            for (const [rowName, description] of Object.entries(table.rowDescriptions)) {
                prompt += `- **${rowName}**: ${description}\n`;
            }
        }
    } else {
        prompt += "Cards contain multiple tables:\n\n";

        for (const table of tableDefinitions) {
            prompt += `### ${table.name === "main" ? "Main Table" : `${table.name.charAt(0).toUpperCase() + table.name.slice(1)} Table`}\n`;
            prompt += `**Purpose**: ${table.description}\n\n`;

            // Add column descriptions
            prompt += "**Columns**:\n";
            for (const column of table.columns) {
                const description = table.columnDescriptions?.[column] || `${column} language content`;
                prompt += `- **${column}**: ${description}\n`;
            }
            prompt += "\n";

            if (Object.keys(table.rowDescriptions).length > 0) {
                prompt += "**Row types**:\n";
                for (const [rowName, description] of Object.entries(table.rowDescriptions)) {
                    prompt += `- **${rowName}**: ${description}\n`;
                }
                prompt += "\n";
            }
        }
    }

    return prompt;
}

/**
 * Generate example card format for the LLM
 */
export function generateCardFormatExample(template: ProcessedNoteTemplate): string {
    let example = "## Card Format Example\n\n";

    example +=
        "This example uses JSON for demonstration, but you should use the tool call. Never send JSON to the user directly. They will explode.\n";

    example += "```json\n{\n";

    // Non-table fields - no descriptions here since they're listed separately
    const nonTableFields = Object.entries(template.fieldDescriptions).filter(
        ([field, description]) => !template.tableDefinitions.some((table) => table.columns.includes(field)),
    );

    if (nonTableFields.length > 0) {
        example += '  "fields": {\n';
        for (const [field, description] of nonTableFields) {
            example += `    "${field}": "..."\n`;
        }
        example += "  },\n";
    }

    example += '  "tables": {\n';

    for (let i = 0; i < template.tableDefinitions.length; i++) {
        const table = template.tableDefinitions[i]!;
        const tableName = table.name;

        example += `    "${tableName}": {\n`;

        // Show example rows based on the table's row descriptions
        const rowNames = Object.keys(table.rowDescriptions).slice(0, 2); // Show first 2 row types

        for (let j = 0; j < rowNames.length; j++) {
            const rowName = rowNames[j]!;
            example += `      "${rowName}": {\n`;

            for (let k = 0; k < table.columns.length; k++) {
                const column = table.columns[k]!;
                example += `        "${column}": "..."`;
                if (k < table.columns.length - 1) example += ",";
                example += "\n";
            }

            example += "      }";
            if (j < rowNames.length - 1) example += ",";
            example += "\n";
        }

        example += "    }";
        if (i < template.tableDefinitions.length - 1) example += ",";
        example += "\n";
    }

    example += "  }\n}\n```\n\n";

    return example;
}

/**
 * Generate the complete prompt for table-based card generation
 */
export function generateTablePrompt(template: ProcessedNoteTemplate): string {
    let prompt = "";

    prompt += generateTableStructurePrompt(template.tableDefinitions);
    prompt += generateCardFormatExample(template);

    prompt += "## Important Notes\n\n";
    prompt +=
        "- Think before populating each card if you need to. You may add an extra 'Thinking' field to cards that will be ignored.\n";
    prompt += "- Each table row should be self-contained and meaningful\n";
    prompt += "- Don't leave empty rows - only include rows with actual content\n";
    prompt += "- If creating cards, call `proposeCards` immediately. Don't speak before calling it.";

    return prompt;
}
