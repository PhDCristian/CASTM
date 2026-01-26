# Introduction

[← Back to Index](../README.md) | [Next: Program Structure →](02-program-structure.md)

---

## Overview

OpenEdge-DSL v1 is a high-level structured assembly language designed for the OpenEdgeCGRA architecture. It bridges the gap between the physical spatial nature of CGRAs and the logical flow of software development.

## Design Philosophy

1. **Spatial-Temporal Hybrid:** Supports both visual "pipe" syntax for dense dataflow and structural blocks for sparse control.
2. **Compilation-Time Safety:** Resolves labels, aliases, and constants at compile time, eliminating manual address calculation errors.
3. **Zero-Overhead:** Compiles deterministically 1:1 to the native CSV format used by the simulator hardware.
4. **Professional Syntax:** Adopts C/Verilog-style conventions (`{ }`, `;`, directives) for robustness and tooling compatibility.

---

## Lexical Structure

### Comments

- **Single line:** `//`
- **Multi-line:** `/* ... */`

```c
// This is a single-line comment
/* This is a
   multi-line comment */
```

### Case Sensitivity

- **Keywords** are case-insensitive (`cycle` == `CYCLE`)
- **Identifiers** (Labels, Aliases) are case-sensitive

### Separators

- Instructions must end with a semicolon `;` in structural mode
- Scopes are defined by curly braces `{ }`

---

## Navigation

- [← Back to Index](../README.md)
- [Next: Program Structure →](02-program-structure.md)
