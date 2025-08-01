import { ParserOptions } from './types';

export interface ParsedCSV {
  headers: string[];
  rows: string[][];
}

export function parseCSV(input: string, options: ParserOptions): ParsedCSV {
  const delimiter = options.delimiter || ',';
  const quote = options.quote || '"';
  const escape = options.escape || '"';
  const skipRows = options.skipRows || 0;
  const skipEmptyLines = options.skipEmptyLines !== false;

  const lines = input.split(/\r?\n/);
  const headers: string[] = [];
  const rows: string[][] = [];

  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;
  let lineIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Skip initial rows if specified
    if (i < skipRows) {
      continue;
    }

    // Skip empty lines if specified
    if (skipEmptyLines && line.trim() === '' && !inQuotes) {
      continue;
    }

    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      const nextChar = line[j + 1];

      if (inQuotes) {
        if (char === quote) {
          if (nextChar === quote && escape === quote) {
            // Escaped quote
            currentField += quote;
            j++; // Skip next character
          } else if (char === quote && j > 0 && line[j - 1] === escape && escape !== quote) {
            // Escaped quote with different escape character
            currentField += quote;
          } else {
            // End of quoted field
            inQuotes = false;
          }
        } else {
          currentField += char;
        }
      } else {
        if (char === quote && (j === 0 || line[j - 1] === delimiter || currentField === '')) {
          // Start of quoted field
          inQuotes = true;
        } else if (char === delimiter) {
          // End of field
          currentRow.push(currentField);
          currentField = '';
        } else {
          currentField += char;
        }
      }
    }

    // Handle line continuation in quoted fields
    if (inQuotes && i < lines.length - 1) {
      currentField += '\n';
      continue;
    }

    // End of line - add the last field
    currentRow.push(currentField);
    currentField = '';

    // Process the completed row
    if (lineIndex === 0) {
      headers.push(...currentRow);
    } else {
      // Only add non-empty rows or if skipEmptyLines is false
      if (!skipEmptyLines || currentRow.some(field => field.trim() !== '')) {
        rows.push([...currentRow]);
      }
    }

    currentRow = [];
    lineIndex++;
  }

  // Handle case where file doesn't end with newline
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField);
    if (lineIndex === 0) {
      headers.push(...currentRow);
    } else {
      rows.push(currentRow);
    }
  }

  return { headers, rows };
}