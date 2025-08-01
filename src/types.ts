export interface ColumnOptions<T, Nullable extends boolean = false> {
  transform?: (value: string) => T;
  validate?: (value: T) => string | undefined;
  nullable?: Nullable;
  defaultValue?: T;
  trim?: boolean;
  caseInsensitiveColumnNames?: boolean;
}

export interface ParseError {
  row: number;
  column: string;
  property: string;
  value: string;
  message: string;
  type: 'transform' | 'validation' | 'missing';
}

export interface ParseResult<T> {
  success: T[];
  errors: ParseError[];
  hasErrors: boolean;
}

export interface ParserOptions {
  delimiter?: string;
  quote?: string;
  escape?: string;
  skipEmptyLines?: boolean;
  skipRows?: number;
  trim?: boolean;
  caseInsensitiveColumnNames?: boolean;
}

export interface ColumnDefinition<T = any> {
  csvNames: string[];
  propertyName: string;
  options: ColumnOptions<T, boolean>;
}