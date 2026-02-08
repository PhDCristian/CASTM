# OpenEdge-DSL Documentation

**Version:** 1.0 (Professional Edition)
**Target Architecture:** OpenEdgeCGRA (4x4 RCs, Shared PC per Column)

OpenEdge-DSL v1 is a high-level structured assembly language designed for the OpenEdgeCGRA architecture. It bridges the gap between the physical spatial nature of CGRAs and the logical flow of software development.

---

## Quick Start

<!-- expect: R0@0,0=1 -->
```c
.const MAX_ITER 10
.alias counter R0

kernel "HelloWorld" {
    config(0xF, 0);

    cycle {
        row 0: SADD counter, ZERO, IMM(1) | _ | _ | _;
    }

    cycle {
        @0,0: EXIT;
    }
}
```

---

## Documentation Structure

### [Language Specification](spec/)

Core language syntax and semantics:

| Document | Description |
|----------|-------------|
| [Introduction](spec/01-introduction.md) | Design philosophy and lexical structure |
| [Program Structure](spec/02-program-structure.md) | Kernel, config, `.data`, `.io_*` directives |
| [Spatial-Temporal](spec/03-spatial-temporal.md) | Cycles, rows, and PE addressing styles |
| [Instruction Set](spec/04-instruction-set.md) | ISA reference, operands, branching |
| [Compilation](spec/05-compilation.md) | Two-pass compilation rules |

### [Advanced Features](features/)

v1.1 language extensions:

| Feature | Description |
|---------|-------------|
| [Named Arrays](features/named-arrays.md) | Memory regions with descriptive names and properties |
| [Functions](features/functions.md) | Reusable code blocks with parameters |
| [For Loops](features/loops/for-loops.md) | Compile-time iteration with `range()` |
| [While Loops](features/loops/while-loops.md) | Runtime loops with branch instructions |
| [Control Flow](features/control-flow.md) | Structured `if-else` statements |
| [Assertions](features/assertions.md) | `.assert` for testing and verification |
| [C-like Expressions](features/clike-expressions.md) | `R1 = R2 + R3;` register expression syntax |

#### [Pragma Directives](features/pragmas/)

| Pragma | Description |
|--------|-------------|
| [Unroll](features/pragmas/unroll.md) | `#pragma unroll`, `unroll(N)`, `no_unroll` |
| [Parallel](features/pragmas/parallel.md) | `#pragma parallel` for SIMD-like execution |
| [Reduce](features/pragmas/reduce.md) | `#pragma reduce` for tree reductions |
| [Stencil](features/pragmas/stencil.md) | `#pragma stencil` for neighbor patterns |
| [Route](features/pragmas/route.md) | `#pragma route` for toroidal PE-to-PE routing |
| [Rotate](features/pragmas/rotate.md) | `#pragma rotate` for circular rotation across PEs |
| [Shift](features/pragmas/shift.md) | `#pragma shift` for linear shift with fill value |

### [Examples](examples/)

Complete, runnable examples organized by category:

- [Basic Examples](examples/basic/) - Simple kernels and control flow
- [Loop Examples](examples/loops/) - For and while loop patterns
- [Parallel Examples](examples/parallel/) - SIMD and reduction patterns
- **[Barrett ModExp Port](examples/barrett/)** - Real-world cryptographic algorithm port

### [Tooling](tooling/)

- [Editor Support](tooling/editor-support.md) - LSP, autocomplete, linting

### [Porting Guide](porting-guide.md)

Patterns and best practices for porting imperative code (Python, C) to OpenEdgeDSL.

---

## Design Philosophy

1. **Spatial-Temporal Hybrid:** Supports both visual "pipe" syntax for dense dataflow and structural blocks for sparse control.
2. **Compilation-Time Safety:** Resolves labels, aliases, and constants at compile time, eliminating manual address calculation errors.
3. **Zero-Overhead:** Compiles deterministically 1:1 to the native CSV format used by the simulator hardware.
4. **Professional Syntax:** Adopts C/Verilog-style conventions (`{ }`, `;`, directives) for robustness and tooling compatibility.

---

## Navigation

- **Next:** [Introduction](spec/01-introduction.md)
