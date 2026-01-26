# OpenEdge-DSL

A domain-specific language for programming Coarse-Grained Reconfigurable Arrays (CGRAs).

## Overview

OpenEdge-DSL is a high-level language designed to simplify CGRA programming by providing:

- **Spatial-temporal abstraction**: Express computations in terms of cycles and PE coordinates
- **High-level constructs**: Loops, conditionals, functions, and pragmas
- **Memory operations**: Named arrays, data initialization, and IO configuration
- **Pattern generators**: Stencil, reduce, scan, broadcast, and route operations

## Installation

```bash
npm install @phdcristian/openedge-dsl
```

## Usage

### Basic Compilation

```typescript
import { compileDslToCsv } from '@phdcristian/openedge-dsl/compiler';

const dslCode = `
kernel example
config 4x4

cycle 0:
  row 0: ADD R0, RCL, R1
  row 1: MUL R1, RCT, R2
`;

const result = compileDslToCsv(dslCode);

if (result.success) {
  console.log(result.csv);
} else {
  console.error(`Error at line ${result.line}: ${result.error}`);
}
```

### Using the Lexer and Parser Directly

```typescript
import { tokenize, TokenType } from '@phdcristian/openedge-dsl';

const tokens = tokenize(sourceCode);
const keywords = tokens.filter(t => t.type === TokenType.KEYWORD);
```

## Language Features

### Program Structure

```dsl
kernel my_program
config 4x4

.const ITERATIONS = 10
.data input[0x100] = [1, 2, 3, 4]

cycle 0:
  row 0: LWI R0, 0x100
  row 1: ADD R1, R0, R2
```

### Control Flow

```dsl
for i in range(0, 4):
  cycle i:
    row 0: ADD R0, RCL, R1

while R0 < 10:
  cycle:
    row 0: ADD R0, R0, 1
```

### Pragmas

```dsl
#pragma parallel collapse(2)
for i in range(0, 4):
  for j in range(0, 4):
    cycle:
      row i, col j: ADD R0, R1, R2

#pragma reduce sum R0
#pragma stencil 3x3
```

## Documentation

See the [docs/](./docs/) directory for complete documentation:

- [Language Specification](./docs/spec/)
- [Feature Guides](./docs/features/)
- [Examples](./docs/examples/)

## API Reference

### Main Exports

| Export | Description |
|--------|-------------|
| `compileDslToCsv(code)` | Compile DSL source to CSV format |
| `tokenize(code)` | Tokenize source code |
| `TokenType` | Enum of token types |
| `generateCsv(ast, symbols)` | Generate CSV from AST |

### Types

| Type | Description |
|------|-------------|
| `Token` | Token with type, value, line, column |
| `CompilationResult` | Result of compilation |
| `KernelAst` | Abstract syntax tree |
| `SymbolTable` | Symbol table with constants, arrays, functions |

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Watch mode
npm run build:watch
```

## License

MIT

## Author

Cristian Campos - PhD Candidate, Universidad de Malaga
