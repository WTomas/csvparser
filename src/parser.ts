import { ColumnOptions, ColumnDefinition, ParseResult, ParseError, ParserOptions } from './types';
import { parseCSV } from './csv-tokenizer';

export class Parser<T extends Record<string, any> = {}> {
  private columns: ColumnDefinition[] = [];
  private options: ParserOptions;

  constructor(options: ParserOptions = {}) {
    this.options = {
      delimiter: ',',
      quote: '"',
      escape: '"',
      skipEmptyLines: true,
      skipRows: 0,
      trim: true,
      ...options
    };
  }

  public col<K extends string, V = string, N extends boolean = false>(
    csvColumnName: string | string[],
    propertyName: K,
    options?: ColumnOptions<V, N>
  ): Parser<T & Record<K, N extends true ? (V | null) : V>> {
    const csvNames = Array.isArray(csvColumnName) ? csvColumnName : [csvColumnName];
    
    this.columns.push({
      csvNames,
      propertyName,
      options: {
        trim: this.options.trim,
        ...options
      }
    });

    return this as any;
  }

  public parse(input: string): ParseResult<T> {
    const errors: ParseError[] = [];
    const success: T[] = [];

    try {
      const { headers, rows } = parseCSV(input, this.options);
      
      // Create header index map
      const headerIndex = new Map<string, number>();
      headers.forEach((header, index) => {
        headerIndex.set(header, index);
      });

      // Process each row
      rows.forEach((row, rowIndex) => {
        const record: any = {};
        let rowHasError = false;

        for (const column of this.columns) {
          // Find the column index
          let columnIndex = -1;
          let matchedColumnName = '';
          
          for (const csvName of column.csvNames) {
            if (headerIndex.has(csvName)) {
              columnIndex = headerIndex.get(csvName)!;
              matchedColumnName = csvName;
              break;
            }
          }

          if (columnIndex === -1) {
            // Column not found
            if (!column.options.nullable && column.options.defaultValue === undefined) {
              errors.push({
                row: rowIndex,
                column: column.csvNames[0],
                property: column.propertyName,
                value: '',
                message: `Column "${column.csvNames.join('" or "')}" not found`,
                type: 'missing'
              });
              rowHasError = true;
            } else {
              record[column.propertyName] = column.options.defaultValue ?? null;
            }
            continue;
          }

          let value: string = row[columnIndex] || '';
          
          // Trim if needed
          if (column.options.trim !== false) {
            value = value.trim();
          }

          // Handle empty values
          if (!value && column.options.nullable) {
            record[column.propertyName] = null;
            continue;
          }

          if (!value && column.options.defaultValue !== undefined) {
            record[column.propertyName] = column.options.defaultValue;
            continue;
          }

          if (!value && !column.options.nullable) {
            errors.push({
              row: rowIndex,
              column: matchedColumnName,
              property: column.propertyName,
              value: '',
              message: 'Required field is empty',
              type: 'validation'
            });
            rowHasError = true;
            continue;
          }

          // Transform the value
          let transformedValue: any = value;
          if (column.options.transform) {
            try {
              transformedValue = column.options.transform(value);
            } catch (e) {
              errors.push({
                row: rowIndex,
                column: matchedColumnName,
                property: column.propertyName,
                value,
                message: e instanceof Error ? e.message : 'Transform function failed',
                type: 'transform'
              });
              rowHasError = true;
              continue;
            }
          }

          // Validate the value
          if (column.options.validate) {
            const validationError = column.options.validate(transformedValue);
            if (validationError) {
              errors.push({
                row: rowIndex,
                column: matchedColumnName,
                property: column.propertyName,
                value,
                message: validationError,
                type: 'validation'
              });
              rowHasError = true;
              continue;
            }
          }

          record[column.propertyName] = transformedValue;
        }

        if (!rowHasError) {
          success.push(record as T);
        }
      });

    } catch (e) {
      throw new Error(`Failed to parse CSV: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }

    return {
      success,
      errors,
      hasErrors: errors.length > 0
    };
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
