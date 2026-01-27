# OpenEdge DSL for Visual Studio Code

Language support for OpenEdge DSL - a domain-specific language for programming Coarse-Grained Reconfigurable Arrays (CGRAs).

## Features

### Syntax Highlighting

Full syntax highlighting for OpenEdge DSL files (`.dsl`):

- Keywords (`kernel`, `cycle`, `for`, `while`, `if`)
- Opcodes (`LWI`, `SWI`, `ADD`, `MUL`, etc.)
- Registers (`R0`-`R15`, `ROUT`, `RCL`)
- Directives (`.const`, `.data`, `.alias`)
- Pragmas (`#pragma reduce`, `#pragma stencil`)
- PE locations (`@0,0:`)
- Comments (`//` and `/* */`)

### IntelliSense

- **Autocompletion** for opcodes, registers, directives, and pragmas
- **Hover documentation** with instruction details and examples
- **Go to Definition** for labels, data arrays, and functions
- **Document Outline** showing kernel structure

### Diagnostics

Real-time error checking:

- Syntax errors (missing semicolons, unclosed braces)
- Unknown opcodes, directives, or pragmas
- Invalid register names

### Snippets

Quick templates for common patterns:

- `kernel` - Create a new kernel
- `cycle` - Create a cycle block
- `for` - Create a for loop
- `#pragma reduce` - Reduction pattern
- `#pragma stencil` - Stencil pattern
- `lcs` - Load-Compute-Store pattern

## Requirements

1. Install the OpenEdge DSL CLI:
   ```bash
   npm install -g @phdcristian/openedge-dsl
   ```

2. Verify the CLI is available:
   ```bash
   openedge --version
   ```

## Extension Settings

This extension contributes the following settings:

| Setting | Default | Description |
|---------|---------|-------------|
| `openedge.diagnostics` | `true` | Enable/disable diagnostics |
| `openedge.completion` | `true` | Enable/disable autocompletion |
| `openedge.hover` | `true` | Enable/disable hover information |
| `openedge.maxNumberOfProblems` | `100` | Maximum problems per file |
| `openedge.trace.server` | `off` | Trace LSP communication |

## Commands

| Command | Description |
|---------|-------------|
| `OpenEdge: Restart Language Server` | Restart the LSP server |
| `OpenEdge: Compile Current File` | Compile the active DSL file |

## Example

```dsl
// Matrix addition kernel
.data input1 @ 0x100 = [1, 2, 3, 4]
.data input2 @ 0x200 = [5, 6, 7, 8]
.data output @ 0x300 = [0, 0, 0, 0]

kernel "MatrixAdd" {
  config(0xF, 0);
  
  #pragma parallel
  for i in range(0, 4) {
    cycle {
      @0,i: LWI R0, input1[i];
      @0,i: LWI R1, input2[i];
    }
    cycle {
      @0,i: ADD R2, R0, R1;
    }
    cycle {
      @0,i: SWI R2, output[i];
    }
  }
}
```

## Known Issues

- The Language Server must be installed globally via npm
- Large files (>1000 lines) may have slower diagnostics

## Release Notes

### 0.1.0

- Initial release
- Syntax highlighting
- LSP integration (diagnostics, completion, hover)
- Snippets for common patterns

## Contributing

Report issues and contribute at:
https://github.com/PhDCristian/OpenEdgeDSL

## License

MIT
