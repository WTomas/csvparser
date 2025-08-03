import { ParserOptions } from './types';

export interface ParsedCSV {
  headers: string[];
  rows: string[][];
}

// Pure function types for parsing state
interface ParseState {
  readonly currentField: string;
  readonly currentRow: string[];
  readonly inQuotes: boolean;
  readonly rows: string[][];
  readonly headers: string[];
  readonly lineIndex: number;
}

interface ParseConfig {
  readonly delimiter: string;
  readonly quote: string;
  readonly escape: string;
  readonly skipRows: number;
  readonly skipEmptyLines: boolean;
}

export function parseCSV(input: string, options: ParserOptions): ParsedCSV {
  const config: ParseConfig = {
    delimiter: options.delimiter || ',',
    quote: options.quote || '"',
    escape: options.escape || '"',
    skipRows: options.skipRows || 0,
    skipEmptyLines: options.skipEmptyLines !== false
  };

  const lines = input.split(/\r?\n/);
  
  // Filter out skipped rows and get relevant lines
  const relevantLines = lines
    .map((line, index) => ({ line, originalIndex: index }))
    .filter(({ originalIndex }) => originalIndex >= config.skipRows);

  // Process lines functionally
  const finalState = relevantLines.reduce<ParseState>(
    (state, { line, originalIndex }) => 
      processLine(line, state, config, originalIndex === lines.length - 1),
    {
      currentField: '',
      currentRow: [],
      inQuotes: false,
      rows: [],
      headers: [],
      lineIndex: 0
    }
  );

  // Handle final field if present
  const result = finalizeParsing(finalState, config);
  
  return {
    headers: result.headers,
    rows: result.rows
  };
}

function processLine(
  line: string,
  state: ParseState,
  config: ParseConfig,
  isLastLine: boolean
): ParseState {
  // Skip empty lines if configured and not in quotes
  if (config.skipEmptyLines && line.trim() === '' && !state.inQuotes) {
    return state;
  }

  // Process the line character by character, handling multi-character delimiters
  let position = 0;
  let field = state.currentField;
  let inQuotes = state.inQuotes;
  const row = [...state.currentRow];

  while (position < line.length) {
    const char = line[position];
    
    if (inQuotes) {
      // In quoted field
      if (char === config.quote) {
        // Check for escaped quote
        if (position + 1 < line.length && line[position + 1] === config.quote && config.escape === config.quote) {
          field += config.quote;
          position += 2; // Skip both quotes
        } else {
          // End of quoted field
          inQuotes = false;
          position++;
        }
      } else if (char === config.escape && config.escape !== config.quote && 
                 position + 1 < line.length && line[position + 1] === config.quote) {
        // Handle escape sequence
        field += config.quote;
        position += 2; // Skip escape and quote
      } else {
        field += char;
        position++;
      }
    } else {
      // Not in quotes
      
      // Check for delimiter (supporting multi-character delimiters)
      if (line.substr(position, config.delimiter.length) === config.delimiter) {
        row.push(field);
        field = '';
        position += config.delimiter.length;
      } else if (char === config.quote && 
                 (position === 0 || line[position - 1] === config.delimiter[config.delimiter.length - 1] || field === '')) {
        // Start of quoted field
        inQuotes = true;
        position++;
      } else {
        field += char;
        position++;
      }
    }
  }

  // Handle line continuation in quoted fields
  if (inQuotes && !isLastLine) {
    return {
      ...state,
      currentField: field + '\n',
      currentRow: row,
      inQuotes: true
    };
  }

  // Complete the row by adding the final field
  const completedRow = [...row, field];
  
  // Determine if this row should be added
  const shouldAddRow = !config.skipEmptyLines || 
    completedRow.some(f => f !== '') || 
    completedRow.length > 1;

  // Update state based on whether this is the first row (headers) or data row
  if (state.lineIndex === 0) {
    return {
      currentField: '',
      currentRow: [],
      inQuotes: false,
      rows: state.rows,
      headers: completedRow,
      lineIndex: state.lineIndex + 1
    };
  }

  return {
    currentField: '',
    currentRow: [],
    inQuotes: false,
    rows: shouldAddRow ? [...state.rows, completedRow] : state.rows,
    headers: state.headers,
    lineIndex: state.lineIndex + 1
  };
}

function finalizeParsing(state: ParseState, config: ParseConfig): ParseState {
  // Handle remaining field or row
  if (state.currentField || state.currentRow.length > 0) {
    const finalRow = [...state.currentRow, state.currentField];
    
    if (state.lineIndex === 0) {
      return {
        ...state,
        headers: finalRow
      };
    } else {
      const shouldAddRow = !config.skipEmptyLines || 
        finalRow.some(field => field !== '') || 
        finalRow.length > 1;
      
      return {
        ...state,
        rows: shouldAddRow ? [...state.rows, finalRow] : state.rows
      };
    }
  }

  return state;
}