---
title: Getting Started
outline: deep
---

# Getting Started

OpenEdge DSL is a high-level structured assembly language designed for the **OpenEdgeCGRA architecture**. It bridges the gap between the physical spatial nature of CGRAs and the logical flow of software development.

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

### Package-based Usage

OpenEdgeDSL is consumed through `@openedge/*` packages (for example `@openedge/compiler-api` and `@openedge/cli`).

## Quick Start

### 1. Write Your First Kernel

Create a file called `hello.edsl`:

```c
target "uma-cgra-base";
let input = { 10, 20 };
let output = { 0 };

kernel "Hello" {
    cycle {
        at @0,0: R0 = input[0];
        at @0,1: R1 = input[1];
    }

    cycle {
        at @0,0: R2 = R0 + R1;
    }

    cycle {
        at @0,0: output[0] = R2;
    }

    cycle {
        at @0,0: EXIT;
    }
}
```

### 2. Compile It

```bash
openedge emit hello.edsl -o hello.csv
```

### 3. Validate and Analyze

```bash
openedge check hello.edsl
openedge analyze hello.edsl
```

## What Next?

- 📖 **[Language Specification](/language/overview)** — Learn the syntax and semantics
- ⚡ **[Features](/features/expressions)** — Explore C-like expressions, pragmas, and more
- 🎯 **[Examples](/examples/basic)** — See complete, runnable kernels
- 🔧 **[CLI Reference](/guide/cli-reference)** — Full command documentation
