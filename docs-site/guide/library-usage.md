---
title: Library Usage
outline: deep
---

# Library Usage

OpenEdge DSL can be used as a TypeScript/JavaScript library for programmatic compilation.

## Installation

```bash
npm install @phdcristian/openedge-dsl
```

## Basic Usage

```typescript
import { compileDslToCsv } from '@phdcristian/openedge-dsl';

const source = `
.data values { 1, 2, 3 }
kernel "Test" {
    config(0xF, 0);
    cycle {
        @0,0: LWI R0, values[0];
    }
}
`;

const result = compileDslToCsv(source);

if (result.success) {
  console.log(result.csv);
  console.log('Cycles:', result.maxCycles);
  console.log('Grid:', result.suggestedGridSize);
  console.log('Memory:', result.memoryRegions);
} else {
  console.error('Error:', result.error);
  console.error('Line:', result.line);
}
```

## API Reference

### Exports

| Export | Description |
|--------|-------------|
| `compileDslToCsv(code)` | Compile DSL source to CSV |
| `tokenize(code)` | Tokenize source code |
| `TokenType` | Enum of token types |
| `generateCsv(ast, symbols)` | Generate CSV from AST |

### `compileDslToCsv(code: string): CompileResult`

Compiles a complete DSL source string and returns a result object:

```typescript
interface CompileResult {
  success: boolean;
  csv?: string;           // Generated CSV output
  maxCycles?: number;     // Number of cycles in the kernel
  suggestedGridSize?: { rows: number; cols: number };
  memoryRegions?: MemoryRegion[];
  error?: string;         // Error message if compilation failed
  line?: number;          // Line number of the error
}
```

### `tokenize(code: string): Token[]`

Low-level tokenizer that returns an array of tokens:

```typescript
interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
}
```

### Package Exports Map

```json
{
  ".": {
    "types": "./dist/index.d.ts",
    "import": "./dist/index.js"
  },
  "./compiler": {
    "types": "./dist/compiler.d.ts",
    "import": "./dist/compiler.js"
  },
  "./cli": {
    "types": "./dist/cli/index.d.ts",
    "import": "./dist/cli/index.js"
  }
}
```
