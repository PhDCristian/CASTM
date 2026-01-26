# OpenEdge DSL

A domain-specific language and compiler toolchain for programming Coarse-Grained Reconfigurable Arrays (CGRAs).

```
   ┌────────────────────────────────────────────────┐
   │                                                │
   │    ╱╲    OpenEdge DSL                          │
   │   ╱  ╲   ─────────────────                     │
   │  ╱    ╲  CGRA Compiler Toolchain    v0.1.0    │
   │ ╱──────╲                                       │
   │                                                │
   └────────────────────────────────────────────────┘
```

## Features

- **Spatial-temporal abstraction**: Express computations in terms of cycles and PE coordinates
- **High-level constructs**: Loops, conditionals, functions, and pragmas
- **Memory operations**: Named arrays, data initialization, and IO configuration
- **Pattern generators**: Stencil, reduce, scan, broadcast, and route operations
- **Premium CLI**: Interactive mode, syntax highlighting, watch mode, themes

## Installation

```bash
# Clone the repository
git clone https://github.com/PhDCristian/OpenEdgeDSL.git
cd OpenEdgeDSL

# Install dependencies
npm install

# Build the CLI
npm run build:cli

# (Optional) Link globally
npm link
```

Or install from npm:

```bash
npm install @phdcristian/openedge-dsl
```

## Quick Start

### Interactive Mode

Launch the interactive menu-driven interface:

```bash
openedge
# or
openedge interactive
openedge i
```

### Command Line

```bash
# Compile DSL to CSV
openedge compile kernel.dsl -o output.csv

# Validate syntax
openedge check kernel.dsl

# Show program info
openedge info kernel.dsl
openedge info kernel.dsl --json

# Watch mode (auto-recompile)
openedge watch kernel.dsl

# Change theme
openedge theme dracula
```

## CLI Commands

| Command | Alias | Description |
|---------|-------|-------------|
| `compile <file>` | | Compile DSL source to CSV format |
| `check <file>` | | Validate syntax without output |
| `info <file>` | | Display program statistics |
| `watch <file>` | `w` | Watch and auto-recompile on changes |
| `interactive` | `i` | Launch interactive mode |
| `theme [name]` | | Change or list themes |

### Compile Options

```bash
openedge compile <file> [options]

Options:
  -o, --output <file>  Output CSV file (default: <input>.csv)
  -q, --quiet          Suppress non-error output
  --no-color           Disable colored output
```

### Info Options

```bash
openedge info <file> [options]

Options:
  --json               Output as JSON
  --no-color           Disable colored output
```

## Interactive Mode

The interactive mode provides a premium menu-driven interface:

```
› Start
❯ Open file
  ────────────────────────────────────────
  Help ?
  Settings
  Exit
```

### Features

- **File Browser**: Navigate directories and select DSL files
- **Recent Files**: Quick access to previously opened files
- **Preview**: View source with syntax highlighting
- **Compile**: Compile to CSV with stats output
- **Validate**: Check syntax without generating output
- **Info**: View program details and memory layout
- **Watch**: Auto-recompile on file changes
- **Help**: Inline help panel
- **Settings**: Configure theme, spinners, and preferences

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `↑` `↓` | Navigate menu |
| `Enter` | Select item |
| `Ctrl+C` | Exit / Cancel |

## Themes

8 built-in themes available:

| Theme | Description |
|-------|-------------|
| `default` | Cyan and green |
| `ocean` | Blue marine tones |
| `sunset` | Warm red and orange |
| `nord` | Nord color palette |
| `dracula` | Purple and green |
| `monokai` | Classic Monokai |
| `cyberpunk` | Bright neon colors |
| `minimal` | Monochrome minimal |

Change theme:

```bash
openedge theme          # List themes
openedge theme dracula  # Set theme
```

## Configuration

Configuration is stored in `~/.openedge/`:

```
~/.openedge/
├── config.json    # Theme, preferences
└── history.json   # Recent files
```

### Config Options

```json
{
  "theme": "default",
  "recentFilesLimit": 10,
  "watchDebounceMs": 300,
  "clearScreenOnAction": true,
  "showSpinners": true
}
```

## DSL Language

### Basic Structure

```dsl
// Data declarations
.data input { 10, 20, 30 }
.data output { 0 }

// Kernel definition
kernel "MyKernel" {
    config(0xF, 0);
    
    cycle {
        @0,0: LWI R0, input[0];
        @0,1: LWI R1, input[1];
    }
    
    cycle {
        @0,0: SADD R2, R0, R1;
    }
    
    cycle {
        @0,0: SWI R2, output[0];
    }
    
    cycle {
        @0,0: EXIT;
    }
}
```

### Directives

| Directive | Description |
|-----------|-------------|
| `.data name { values }` | Declare data array |
| `.const NAME value` | Define constant |
| `.alias NAME value` | Create alias |

### Operations

| Operation | Description |
|-----------|-------------|
| `LWI Rd, addr` | Load word immediate |
| `SWI Rs, addr` | Store word immediate |
| `SADD Rd, Rs1, Rs2` | Signed add |
| `SSUB Rd, Rs1, Rs2` | Signed subtract |
| `SMUL Rd, Rs1, Rs2` | Signed multiply |
| `NOP` | No operation |
| `EXIT` | End execution |

### Registers

- `R0` - `R7`: General purpose registers
- `ROUT`: Output register (for routing)
- `RCL`, `RCR`, `RCU`, `RCD`: Neighbor registers (left, right, up, down)
- `ZERO`: Zero constant

### Control Flow

```dsl
for i in range(0, 4) {
    cycle {
        @0,i: ADD R0, RCL, R1;
    }
}

#pragma parallel collapse(2)
for i in range(0, 4) {
    for j in range(0, 4) {
        cycle {
            @i,j: ADD R0, R1, R2;
        }
    }
}
```

### Pragmas

```dsl
#pragma reduce(add, R0, R1)
#pragma stencil(cross, add, R0, R1)
#pragma route (0,0) -> (3,3) payload(R0) accum(R1)
```

## Output Format

The compiler generates CSV format compatible with CGRA simulators:

```csv
0
"LWI R0, 0", "LWI R1, 4", NOP, NOP
NOP, NOP, NOP, NOP
...
1
"SADD R2, R0, R1", NOP, NOP, NOP
...
```

## Library Usage

Use OpenEdge DSL as a library:

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
  console.log('Memory:', result.memoryRegions);
} else {
  console.error('Error:', result.error);
  console.error('Line:', result.line);
}
```

### API Reference

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

# Build TypeScript
npm run build

# Build CLI bundle
npm run build:cli

# Run tests
npm test

# Watch mode for development
npm run build:watch
```

## Documentation

See the [docs/](./docs/) directory for complete documentation:

- [Language Specification](./docs/spec/)
- [Feature Guides](./docs/features/)
- [Examples](./docs/examples/)

## License

MIT License - see [LICENSE](LICENSE) for details.

## Author

Cristian Campos <cristian@uma.es>  
PhD Candidate, Universidad de Málaga

## Links

- [Repository](https://github.com/PhDCristian/OpenEdgeDSL)
- [Issues](https://github.com/PhDCristian/OpenEdgeDSL/issues)
