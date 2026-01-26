# Tooling & Editor Support

[← Back to Index](../README.md)

---

The OpenEdge-DSL ecosystem includes a Language Server Protocol (LSP) compatible editor integration (Monaco-based) that provides intelligent editing features.

## Configuration

The environment supports dynamic configuration of the target architecture:

| Setting | Description | Default |
|---------|-------------|---------|
| **Grid Dimensions** | Width × Height | 4×4 (up to 8×8) |
| **Register Set** | Available registers per PE | R0-R3, ROUT |

---

## Static Analysis (Linting)

The editor provides real-time validation:

### Bounds Checking

- **Error** if `row <n>` or `col <n>` exceeds configured dimensions
- **Error** if a visual pipe row has more columns than grid width

```c
row 5: ...;  // Error: row 5 exceeds 4x4 grid
row 0: A | B | C | D | E;  // Error: 5 columns exceed width
```

### Register Validation

- **Error** if operand uses non-existent register
- **Warning** for deprecated register usage

```c
SADD R5, R0, R1;  // Error: R5 is not a valid register
```

### Instruction Safety

- Validation of operand count and types for each opcode
- Detection of unreachable code after `EXIT`

```c
EXIT;
SADD R0, R0, R1;  // Warning: unreachable code
```

---

## Intelligent Autocomplete

### Context-Aware Suggestions

| Context | Suggestions |
|---------|-------------|
| Top-level | `kernel`, `.const`, `.alias`, `.data`, `.io_load`, `.io_store` |
| Inside kernel | `cycle`, `config`, `for`, `while`, `if`, `#pragma` |
| Inside cycle | `row`, `@`, instructions |
| Instruction | `SADD`, `LWD`, `BEQ`, etc. |
| Operand | `R0`-`R3`, `ROUT`, `SELF`, `RCL`, `RCR`, `RCT`, `RCB` |
| Branch target | Defined labels |
| Constant ref | `.const` names |

### Snippets

Common pattern templates:

| Snippet | Expansion |
|---------|-----------|
| `kernel` | Full kernel skeleton |
| `cycle` | Cycle block with row |
| `for` | For loop with range |
| `while` | While loop template |
| `if` | If-else structure |
| `#parallel` | Parallel pragma with loop |

---

## Syntax Highlighting

| Element | Color |
|---------|-------|
| Keywords | Blue (`kernel`, `cycle`, `row`, `config`) |
| Instructions | Purple (`SADD`, `LWD`, `BEQ`) |
| Registers | Green (`R0`, `R1`, `ROUT`) |
| Neighbors | Cyan (`SELF`, `RCL`, `RCR`, `RCT`, `RCB`) |
| Immediates | Orange (`IMM(10)`, numbers) |
| Labels | Yellow |
| Directives | Magenta (`.const`, `.alias`, `#pragma`) |
| Comments | Gray |
| Strings | Brown |

---

## Error Messages

Clear, actionable error messages:

```
Error at line 15, column 8:
  Unknown instruction 'ADDD'. Did you mean 'SADD'?

Error at line 23, column 12:
  Undefined label 'looop_start'. Defined labels: loop_start, end

Error at line 31, column 4:
  Row 5 exceeds grid height (4). Configure larger grid or use row 0-3.
```

---

## Integration

The editor is integrated into the CGRA Simulator web application:

- **Code Mode:** Full DSL editor with syntax highlighting
- **Visual Mode:** Graphical PE grid editor
- **Compile:** Real-time compilation to CSV format
- **Simulate:** Step-through execution with state visualization

---

## Navigation

- [← Back to Index](../README.md)
