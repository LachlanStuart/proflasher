import type { TableDefinition } from "../cardModel/tableCard";
import type { ProcessedNoteTemplate } from "../cardModel/noteTemplates";

/**
 * Generate a prompt section describing the table structure for the LLM
 */
export function generateTableStructurePrompt(tableDefinitions: TableDefinition[]): string {
    let prompt = "## Card Structure\n\n";

    if (tableDefinitions.length === 1) {
        const table = tableDefinitions[0]!;
        prompt += `Cards contain a table with columns: ${table.columns.join(", ")}\n\n`;
        prompt += `${table.description}\n\n`;

        if (Object.keys(table.rowDescriptions).length > 0) {
            prompt += "Row types and their purposes:\n";
            for (const [rowName, description] of Object.entries(table.rowDescriptions)) {
                prompt += `- **${rowName}**: ${description}\n`;
            }
        }
    } else {
        prompt += "Cards contain multiple tables:\n\n";

        for (const table of tableDefinitions) {
            prompt += `### ${table.name === 'main' ? 'Main Table' : table.name.charAt(0).toUpperCase() + table.name.slice(1) + ' Table'}\n`;
            prompt += `Columns: ${table.columns.join(", ")}\n`;
            prompt += `Purpose: ${table.description}\n\n`;

            if (Object.keys(table.rowDescriptions).length > 0) {
                prompt += "Row types:\n";
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

    example += "```json\n{\n";

    // Non-table fields
    const nonTableFields = Object.entries(template.fieldDescriptions).filter(([field, description]) =>
        !template.tableDefinitions.some(table => table.columns.includes(field))
    );

    if (nonTableFields.length > 0) {
        example += '  "fields": {\n';
        for (const [field, description] of nonTableFields) {
            example += `    "${field}": "...", // ${description}\n`;
        }
        example += '  },\n';
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
                if (k < table.columns.length - 1) example += ',';
                example += '\n';
            }

            example += '      }';
            if (j < rowNames.length - 1) example += ',';
            example += '\n';
        }

        example += '    }';
        if (i < template.tableDefinitions.length - 1) example += ',';
        example += '\n';
    }

    example += '  }\n}\n```\n\n';

    return example;
}

/**
 * Generate instructions for working with specific rows
 */
export function generateRowWorkingInstructions(template: ProcessedNoteTemplate): string {
    let instructions = "## Working with Rows\n\n";

    instructions += "When creating or modifying cards:\n";
    instructions += "1. Focus on one row at a time for clarity\n";
    instructions += "2. Ensure all columns in a row are properly filled\n";
    instructions += "3. Keep related information in the same row\n";
    instructions += "4. Use appropriate row names that reflect the content type\n\n";

    // Add table-specific instructions
    for (const table of template.tableDefinitions) {
        if (table.name === 'main') {
            instructions += `**Main Table (${table.columns.join(', ')})**: `;
            instructions += `Use this for primary vocabulary and example sentences. `;
        } else {
            instructions += `**${table.name} Table (${table.columns.join(', ')})**: `;
            instructions += `${table.description}. `;
        }
        instructions += "Each row should contain related content across all columns.\n\n";
    }

    return instructions;
}

/**
 * Generate the complete prompt for table-based card generation
 */
export function generateTablePrompt(template: ProcessedNoteTemplate): string {
    let prompt = "";

    prompt += generateTableStructurePrompt(template.tableDefinitions);
    prompt += generateCardFormatExample(template);
    prompt += generateRowWorkingInstructions(template);

    prompt += "## Important Notes\n\n";
    prompt += "- Always use the table JSON format shown above\n";
    prompt += "- Think before populating each row if you need to\n";
    prompt += "- Each table row should be self-contained and meaningful\n";
    prompt += "- Don't leave empty rows - only include rows with actual content\n";
    prompt += "- If creating cards, call `proposeCards` immediately. Don't speak before calling it.";
    prompt += " It has arguments in case you need to add a message.\n";

    return prompt;
}
