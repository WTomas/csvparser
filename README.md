# CSV Parser

A modern, type-safe CSV parser for TypeScript with zero dependencies. Built from scratch with a functional programming approach, featuring advanced type inference, flexible validation, and comprehensive error handling.

## Features

- 🎯 **Type-safe** - Complete TypeScript support with automatic type inference
- 🔄 **Transform & Validate** - Built-in data transformation and validation pipeline
- 🚫 **Zero Dependencies** - No external dependencies, lightweight and secure
- 🛡️ **Error Handling** - Comprehensive error reporting with precise row/column information
- 🔧 **Flexible** - Support for custom delimiters, quotes, and parsing options
- 🏗️ **Immutable** - Functional programming approach with immutable parser instances
- 📱 **Modern** - ES modules, async support, and File API compatibility

## Installation

```bash
npm install csv-parser-ts
# or
yarn add csv-parser-ts
```

## Quick Start

```typescript
import { Parser } from 'csv-parser-ts';

const parser = new Parser()
  .col('Name', 'name')
  .col('Age', 'age', { transform: (v) => parseInt(v) })
  .col('Email', 'email', { nullable: true });

const csv = `Name,Age,Email
John,30,john@example.com
Jane,25,
Bob,35,bob@example.com`;

const result = parser.parse(csv);

console.log(result.success);
// [
//   { name: 'John', age: 30, email: 'john@example.com' },
//   { name: 'Jane', age: 25, email: null },
//   { name: 'Bob', age: 35, email: 'bob@example.com' }
// ]
```

## Parser Options

Configure global parsing behavior:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `delimiter` | `string` | `','` | Field separator (supports multi-character) |
| `quote` | `string` | `'"'` | Quote character |
| `escape` | `string` | `'"'` | Escape character |
| `skipEmptyLines` | `boolean` | `true` | Skip empty lines |
| `skipRows` | `number` | `0` | Number of rows to skip at start |
| `trim` | `boolean` | `true` | Trim whitespace from fields |
| `caseInsensitiveColumnNames` | `boolean` | `false` | Case-insensitive column matching |

```typescript
const parser = new Parser({
  delimiter: ';',
  skipRows: 1,
  caseInsensitiveColumnNames: true
});
```

## Column Definition

### Basic Column Mapping

```typescript
const parser = new Parser()
  .col('First Name', 'firstName')  // CSV column → object property
  .col('Last Name', 'lastName');
```

### Column Aliases

Map multiple possible column names to the same property:

```typescript
const parser = new Parser()
  .col(['Name', 'Full Name', 'Customer Name'], 'name')
  .col(['Email', 'Email Address'], 'email');
```

### Type Transformations

Transform string values to other types:

```typescript
const parser = new Parser()
  .col('Age', 'age', { transform: (v) => parseInt(v) })
  .col('Price', 'price', { transform: (v) => parseFloat(v) })
  .col('Active', 'active', { transform: (v) => v.toLowerCase() === 'true' })
  .col('Tags', 'tags', { transform: (v) => v.split(',').map(s => s.trim()) });

// Resulting type: { age: number, price: number, active: boolean, tags: string[] }
```

### Nullable Fields

Handle optional/missing values:

```typescript
const parser = new Parser()
  .col('Name', 'name')                    // Required field
  .col('Email', 'email', { nullable: true })    // Optional field
  .col('Phone', 'phone', { nullable: true });   // Optional field

// Type: { name: string, email: string | null, phone: string | null }
```

### Default Values

Provide fallback values for missing fields:

```typescript
const parser = new Parser()
  .col('Name', 'name')
  .col('Role', 'role', { defaultValue: 'user' })
  .col('Score', 'score', { 
    transform: (v) => parseInt(v), 
    defaultValue: 0 
  });
```

## Validation

### Column Validation

Validate individual field values after transformation:

```typescript
const parser = new Parser()
  .col('Email', 'email', {
    validate: (v) => v.includes('@') ? undefined : 'Invalid email format'
  })
  .col('Age', 'age', {
    transform: (v) => parseInt(v),
    validate: (v) => v >= 0 && v <= 120 ? undefined : 'Age must be between 0 and 120'
  });
```

### Row Validation

Validate entire rows with cross-field validation:

```typescript
const parser = new Parser()
  .col('StartDate', 'startDate', { transform: (v) => new Date(v) })
  .col('EndDate', 'endDate', { transform: (v) => new Date(v) })
  .val((row) => {
    if (row.endDate <= row.startDate) {
      return 'End date must be after start date';
    }
    return undefined; // Valid
  });
```

### Complex Business Rules

```typescript
const parser = new Parser()
  .col('Price', 'price', { transform: (v) => parseFloat(v) })
  .col('Quantity', 'quantity', { transform: (v) => parseInt(v) })
  .col('Total', 'total', { transform: (v) => parseFloat(v) })
  .val((row) => {
    const expectedTotal = row.price * row.quantity;
    if (Math.abs(expectedTotal - row.total) > 0.01) {
      return `Total calculation error: expected ${expectedTotal.toFixed(2)}, got ${row.total}`;
    }
    return undefined;
  });
```

## Error Handling

The parser provides detailed error information for debugging:

```typescript
const result = parser.parse(csv);

if (result.hasErrors) {
  result.errors.forEach(error => {
    console.log(`Row ${error.row}: ${error.message}`);
    
    if (error.type !== 'row-validation') {
      console.log(`  Column: ${error.column}`);
      console.log(`  Property: ${error.property}`);
      console.log(`  Value: ${error.value}`);
    }
  });
}
```

### Error Types

| Type | Description |
|------|-------------|
| `transform` | Error during data transformation |
| `validation` | Field validation failure |
| `missing` | Required column not found |
| `row-validation` | Row-level validation failure |

⚠️ **Row Numbers**: Error row numbers correspond to actual CSV file rows (including header), making it easy to locate issues in spreadsheet applications.

## Advanced Features

### Case-Insensitive Column Matching

```typescript
// Global setting
const parser = new Parser({ caseInsensitiveColumnNames: true })
  .col('NAME', 'name')  // Matches "name", "Name", "NAME", etc.

// Per-column setting
const parser2 = new Parser()
  .col('NAME', 'name', { caseInsensitiveColumnNames: true });
```

### Multi-Character Delimiters

```typescript
const parser = new Parser({ delimiter: '::' })
  .col('Name', 'name')
  .col('Value', 'value');

const csv = 'Name::Value\nJohn::123\nJane::456';
```

### Custom Quote and Escape Characters

```typescript
const parser = new Parser({
  delimiter: '|',
  quote: "'",
  escape: '\\'
});
```

### Async File Parsing

```typescript
// Parse File objects (browser)
const fileInput = document.getElementById('csv-file') as HTMLInputElement;
const file = fileInput.files[0];

const result = await parser.parseAsync(file);

// Parse strings asynchronously
const result2 = await parser.parseAsync(csvString);
```

## Type Inference

The parser automatically infers result types based on your column definitions:

```typescript
const parser = new Parser()
  .col('Name', 'name')                                    // string
  .col('Age', 'age', { transform: (v) => parseInt(v) })   // number
  .col('Active', 'active', { transform: (v) => v === 'true' }) // boolean
  .col('Email', 'email', { nullable: true })              // string | null
  .col('Score', 'score', { 
    transform: (v) => parseInt(v), 
    defaultValue: 0 
  });                                                      // number

// Inferred type:
// {
//   name: string;
//   age: number;
//   active: boolean;
//   email: string | null;
//   score: number;
// }
```

💡 **Tip**: The parser uses TypeScript's advanced type system to provide compile-time type safety while maintaining runtime flexibility.

## Complete Example

```typescript
import { Parser } from 'csv-parser-ts';

// Employee data parser with comprehensive validation
const employeeParser = new Parser({ delimiter: ',' })
  .col('Employee ID', 'id', {
    validate: (v) => /^EMP\d{3}$/.test(v) ? undefined : 'ID must match pattern EMP###'
  })
  .col(['Full Name', 'Name'], 'name', {
    validate: (v) => v.length >= 2 ? undefined : 'Name must be at least 2 characters'
  })
  .col('Email', 'email', {
    validate: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? undefined : 'Invalid email'
  })
  .col('Salary', 'salary', {
    transform: (v) => parseFloat(v),
    validate: (v) => v > 0 ? undefined : 'Salary must be positive'
  })
  .col('Start Date', 'startDate', {
    transform: (v) => new Date(v),
    validate: (d) => !isNaN(d.getTime()) ? undefined : 'Invalid date format'
  })
  .col('Department', 'department', {
    validate: (v) => ['HR', 'Engineering', 'Sales', 'Marketing'].includes(v) 
      ? undefined : 'Invalid department'
  })
  .col('Manager', 'manager', { nullable: true })
  .val((employee) => {
    // Cross-field validation
    if (employee.department === 'Engineering' && employee.salary < 50000) {
      return 'Engineering salaries must be at least $50,000';
    }
    return undefined;
  });

const csv = `Employee ID,Full Name,Email,Salary,Start Date,Department,Manager
EMP001,John Smith,john@company.com,75000,2023-01-15,Engineering,
EMP002,Jane Doe,jane@company.com,65000,2023-02-01,Engineering,John Smith
INVALID,Bob,invalid-email,30000,bad-date,InvalidDept,`;

const result = employeeParser.parse(csv);

console.log('Successful records:', result.success.length);
console.log('Errors:', result.errors.length);

result.errors.forEach(error => {
  console.log(`Row ${error.row}: ${error.message}`);
});
```

## License

MIT