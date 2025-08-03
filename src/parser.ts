import { ColumnOptions, ColumnDefinition, ParseResult, ParseError, ParserOptions, RowValidator } from './types';
import { parseCSV } from './csv-tokenizer';

// Pure function types
type ColumnMatch = { columnIndex: number; columnName: string } | null;
type FieldResult = { value: any; error?: ParseError } | { value?: never; error: ParseError };
type RowResult = { record: any; errors: ParseError[] };

export class Parser<T extends Record<string, any> = {}> {
  private readonly columns: ColumnDefinition[] = [];
  private readonly options: ParserOptions;
  private readonly rowValidators: RowValidator<T>[] = [];

  constructor(options: ParserOptions = {}) {
    this.options = {
      delimiter: ',',
      quote: '"',
      escape: '"',
      skipEmptyLines: true,
      skipRows: 0,
      trim: true,
      caseInsensitiveColumnNames: false,
      ...options
    };
  }

  public col<K extends string, V = string, N extends boolean = false>(
    csvColumnName: string | string[],
    propertyName: K,
    options?: ColumnOptions<V, N>
  ): Parser<T & Record<K, N extends true ? (V | null) : V>> {
    const csvNames = Array.isArray(csvColumnName) ? csvColumnName : [csvColumnName];
    
    // Create new parser instance with updated columns (immutable)
    const newParser = Object.create(Object.getPrototypeOf(this));
    newParser.columns = [
      ...this.columns,
      {
        csvNames,
        propertyName,
        options: {
          trim: this.options.trim,
          caseInsensitiveColumnNames: this.options.caseInsensitiveColumnNames,
          ...options
        }
      }
    ];
    newParser.options = this.options;
    newParser.rowValidators = this.rowValidators;
    
    return newParser;
  }

  public val(validator: RowValidator<T>): Parser<T> {
    // Create new parser instance with updated validators (immutable)
    const newParser = Object.create(Object.getPrototypeOf(this));
    newParser.columns = this.columns;
    newParser.options = this.options;
    newParser.rowValidators = [...this.rowValidators, validator];
    
    return newParser;
  }

  public parse(input: string): ParseResult<T> {
    try {
      const { headers, rows } = parseCSV(input, this.options);
      
      // Create header index map using reduce
      const headerIndex = headers.reduce<Map<string, number>>(
        (map, header, index) => map.set(header, index),
        new Map()
      );

      // Process all rows functionally
      const results = rows.map((row, rowIndex) => 
        this.processRow(row, rowIndex, headerIndex)
      );

      // Separate successes and errors
      const success = results
        .filter(result => result.errors.length === 0)
        .map(result => result.record as T);

      const errors = results.flatMap(result => result.errors);

      return {
        success,
        errors,
        hasErrors: errors.length > 0
      };
    } catch (e) {
      throw new Error(`Failed to parse CSV: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  }

  private processRow(row: string[], rowIndex: number, headerIndex: Map<string, number>): RowResult {
    const columnResults = this.columns.map(column => ({
      column,
      result: this.processColumn(column, row, rowIndex, headerIndex)
    }));

    const errors = columnResults
      .map(({ result }) => result.error)
      .filter((error): error is ParseError => error !== undefined);

    const record = columnResults.reduce((acc, { column, result }) => {
      if ('value' in result) {
        return { ...acc, [column.propertyName]: result.value };
      }
      return acc;
    }, {});

    // Apply row validators only if there are no column errors
    if (errors.length === 0 && this.rowValidators.length > 0) {
      const rowValidationErrors = this.rowValidators
        .map(validator => {
          const error = validator(record as T);
          if (error) {
            return {
              row: rowIndex,
              column: undefined,
              property: '_row',
              value: JSON.stringify(record),
              message: error,
              type: 'row-validation' as const
            } as ParseError;
          }
          return null;
        })
        .filter((error): error is ParseError => error !== null);
      
      errors.push(...rowValidationErrors);
    }

    return { record, errors };
  }

  private processColumn(
    column: ColumnDefinition,
    row: string[],
    rowIndex: number,
    headerIndex: Map<string, number>
  ): FieldResult {
    const match = this.findColumnMatchForColumn(column, headerIndex);

    if (!match) {
      return this.handleMissingColumn(column, rowIndex);
    }

    const rawValue = row[match.columnIndex] || '';
    const trimmedValue = column.options.trim !== false ? rawValue.trim() : rawValue;

    if (!trimmedValue) {
      return this.handleEmptyValue(column, match.columnName, rowIndex);
    }

    return this.transformAndValidate(trimmedValue, column, match.columnName, rowIndex);
  }

  private findColumnMatchForColumn(column: ColumnDefinition, headerIndex: Map<string, number>): ColumnMatch {
    // Try exact match first
    const exactMatch = column.csvNames
      .map(name => ({ name, index: headerIndex.get(name) }))
      .find(({ index }) => index !== undefined);

    if (exactMatch && exactMatch.index !== undefined) {
      return { columnIndex: exactMatch.index, columnName: exactMatch.name };
    }

    // Check case-insensitive matching (column-level or parser-level option)
    const shouldUseCaseInsensitive = column.options.caseInsensitiveColumnNames ?? this.options.caseInsensitiveColumnNames;
    
    if (shouldUseCaseInsensitive) {
      const caseInsensitiveMatch = this.findCaseInsensitiveMatch(column.csvNames, headerIndex);
      if (caseInsensitiveMatch) {
        return caseInsensitiveMatch;
      }
    }

    return null;
  }


  private findCaseInsensitiveMatch(csvNames: string[], headerIndex: Map<string, number>): ColumnMatch | null {
    const headerEntries = Array.from(headerIndex.entries());
    
    for (const csvName of csvNames) {
      const lowerCsvName = csvName.toLowerCase();
      const match = headerEntries.find(([header]) => header.toLowerCase() === lowerCsvName);
      
      if (match) {
        const [originalHeaderName, index] = match;
        return { columnIndex: index, columnName: originalHeaderName };
      }
    }

    return null;
  }

  private handleMissingColumn(column: ColumnDefinition, rowIndex: number): FieldResult {
    if (!column.options.nullable && column.options.defaultValue === undefined) {
      return {
        error: {
          row: rowIndex,
          column: column.csvNames[0],
          property: column.propertyName,
          value: '',
          message: `Column "${column.csvNames.join('" or "')}" not found`,
          type: 'missing'
        }
      };
    }

    return { value: column.options.defaultValue ?? null };
  }

  private handleEmptyValue(
    column: ColumnDefinition,
    columnName: string,
    rowIndex: number
  ): FieldResult {
    if (column.options.nullable) {
      return { value: null };
    }

    if (column.options.defaultValue !== undefined) {
      return { value: column.options.defaultValue };
    }

    return {
      error: {
        row: rowIndex,
        column: columnName,
        property: column.propertyName,
        value: '',
        message: 'Required field is empty',
        type: 'validation'
      }
    };
  }

  private transformAndValidate(
    value: string,
    column: ColumnDefinition,
    columnName: string,
    rowIndex: number
  ): FieldResult {
    // Apply transform
    const transformResult = this.applyTransform(value, column.options.transform);
    
    if ('error' in transformResult) {
      return {
        error: {
          row: rowIndex,
          column: columnName,
          property: column.propertyName,
          value,
          message: transformResult.error,
          type: 'transform'
        }
      };
    }

    // Apply validation
    const validationError = column.options.validate?.(transformResult.value);
    
    if (validationError) {
      return {
        error: {
          row: rowIndex,
          column: columnName,
          property: column.propertyName,
          value,
          message: validationError,
          type: 'validation'
        }
      };
    }

    return { value: transformResult.value };
  }

  private applyTransform(
    value: string,
    transform?: (value: string) => any
  ): { value: any } | { error: string } {
    if (!transform) {
      return { value };
    }

    try {
      return { value: transform(value) };
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Transform function failed' };
    }
  }

  public async parseAsync(input: string | File): Promise<ParseResult<T>> {
    if (typeof input === 'string') {
      return this.parse(input);
    }

    // Handle File input
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        try {
          resolve(this.parse(text));
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(input);
    });
  }
}
