# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Build
```bash
yarn build
```
Builds the library using tsup, generating CommonJS, ESM modules, and TypeScript declarations.

### Type Checking and Linting
```bash
yarn lint
```
Runs TypeScript compiler for type checking (no emit).

### Testing
```bash
yarn test:unit
```
Runs Jest unit tests with ts-jest. Test files should match `*.spec.ts` pattern.

### Publishing
```bash
yarn publish
```
Uses changesets for publishing to npm.

## Architecture

This is a TypeScript CSV parser library built on top of fast-csv. The main components are:

### Core Parser (`src/parser.ts`)
- `CSVParser<T>` class provides a fluent API for defining CSV column mappings
- Uses method chaining pattern: `.col()` to define columns, `.parse()` to execute
- Supports transforms, validations, and nullable columns
- Handles both file paths and string inputs

### Type System (`src/types.ts`)
- `CSVParserOptions`: Global parser options (case sensitivity)
- `CSVParserColumnOptions<V>`: Per-column configuration (transform, validate, nullable)
- `CSVParserError`: Structured error reporting with row/column information

### Key Features
- Type-safe column mapping with TypeScript generics
- Chainable API that builds up the result type incrementally
- Custom transform functions for data conversion
- Validation with error accumulation
- Support for nullable fields
- Case-insensitive column name matching option

### Usage Pattern
```typescript
const parser = new CSVParser()
  .col('Name', 'name')
  .col('Age', 'age', { transform: (v) => parseInt(v) })
  .col('Email', 'email', { nullable: true });

const result = await parser.parse('file.csv');
```