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

// Character processing result
interface CharResult {
  readonly field: string;
  readonly inQuotes: boolean;
  readonly skipNext: boolean;
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

  // Process all characters in the line
  const chars = Array.from(line);
  const { field, inQuotes, row } = chars.reduce<{
    field: string;
    inQuotes: boolean;
    row: string[];
    skipNext: boolean;
  }>(
    (acc, char, index) => {
      if (acc.skipNext) {
        return { ...acc, skipNext: false };
      }

      const charResult = processCharacter(
        char,
        acc.field,
        acc.inQuotes,
        config,
        chars[index + 1],
        chars[index - 1]
      );

      if (char === config.delimiter && !acc.inQuotes) {
        return {
          field: '',
          inQuotes: charResult.inQuotes,
          row: [...acc.row, acc.field], // Use acc.field, not charResult.field for delimiter
          skipNext: charResult.skipNext
        };
      }

      return {
        field: charResult.field,
        inQuotes: charResult.inQuotes,
        row: acc.row,
        skipNext: charResult.skipNext
      };
    },
    {
      field: state.currentField,
      inQuotes: state.inQuotes,
      row: state.currentRow,
      skipNext: false
    }
  );

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

function processCharacter(
  char: string,
  currentField: string,
  inQuotes: boolean,
  config: ParseConfig,
  nextChar?: string,
  prevChar?: string
): CharResult {
  if (inQuotes) {
    return processQuotedCharacter(char, currentField, config, nextChar, prevChar);
  } else {
    return processUnquotedCharacter(char, currentField, config, prevChar);
  }
}

function processQuotedCharacter(
  char: string,
  currentField: string,
  config: ParseConfig,
  nextChar?: string,
  prevChar?: string
): CharResult {
  if (char === config.quote) {
    // Handle escaped quotes
    if (nextChar === config.quote && config.escape === config.quote) {
      return {
        field: currentField + config.quote,
        inQuotes: true,
        skipNext: true
      };
    }
    
    // End of quoted field
    return {
      field: currentField,
      inQuotes: false,
      skipNext: false
    };
  }

  // Handle escape sequences
  if (char === config.escape && config.escape !== config.quote && nextChar === config.quote) {
    return {
      field: currentField + config.quote,
      inQuotes: true,
      skipNext: true
    };
  }

  return {
    field: currentField + char,
    inQuotes: true,
    skipNext: false
  };
}

function processUnquotedCharacter(
  char: string,
  currentField: string,
  config: ParseConfig,
  prevChar?: string
): CharResult {
  if (char === config.quote && 
      (prevChar === undefined || prevChar === config.delimiter || currentField === '')) {
    return {
      field: currentField,
      inQuotes: true,
      skipNext: false
    };
  }

  return {
    field: currentField + char,
    inQuotes: false,
    skipNext: false
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