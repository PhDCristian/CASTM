---
title: Getting Started
outline: deep
---

# Getting Started

OpenEdge DSL is a high-level structured assembly language designed for the **OpenEdgeCGRA architecture** (4×4 mesh of Reconfigurable Cells with Shared PC per Column). It bridges the gap between the physical spatial nature of CGRAs and the logical flow of software development.

## Prerequisites

- **Node.js** ≥ 18.0.0
- **npm** ≥ 8.0.0

## Installation

### From Source

```bash
git clone https://github.com/PhDCristian/OpenEdgeDSL.git
cd OpenEdgeDSL
npm install
npm run build:cli
npm link  # Optional: install globally
```

### From npm

```bash
npm install -g @phdcristian/openedge-dsl
```

## Quick Start

### 1. Write Your First Kernel

Create a file called `hello.edsl`:

```c
.data input { 10, 20 }
.data output { 0 }

kernel "Hello" {
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

### 2. Compile It

```bash
openedge compile hello.edsl -o hello.csv
```

### 3. Inspect the Output

```bash
openedge info hello.edsl
```

```
  ✓ Program: hello.edsl

    Status:      Valid
    Cycles:      4
    Grid:        2×2
    Memory:      2 region(s)
        input: 0x0 (2 values)
        output: 0x8 (1 values)
```

## Using the TUI

OpenEdge DSL features a modern Terminal UI with side-by-side preview:

```bash
openedge tui  # or just 'openedge t'
```

```
 ┌──────────────────────────────────────┐┌────────────────────────────────────┐
 │ Browse > /projects/cgra              ││ ◇ kernel.dsl                       │
 │                                      ││ 1 │ .data input { 10 }             │
 │ ❯ ▪ examples                         ││ 2 │ kernel "Test" {                │
 │   ▫ simple.dsl                       ││ 3 │   cycle {                      │
 │   ▫ matrix_mul.dsl                   ││ 4 │     @0,0: LWI R0, input[0];    │
 │   ..                                 ││ 5 │   }                            │
 └──────────────────────────────────────┘└────────────────────────────────────┘
   ↑↓ navigate   ⏎ select   ESC back   ^C exit
```

## What Next?

- 📖 **[Language Specification](/language/overview)** — Learn the syntax and semantics
- ⚡ **[Features](/features/expressions)** — Explore C-like expressions, pragmas, and more
- 🎯 **[Examples](/examples/basic)** — See complete, runnable kernels
- 🔧 **[CLI Reference](/guide/cli-reference)** — Full command documentation
