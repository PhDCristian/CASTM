---
title: Getting Started
outline: deep
---

# Getting Started

OpenEdgeDSL uses canonical syntax and compiles deterministically to CSV for OpenEdge CGRA flows.

## Prerequisites

- Node.js >= 18
- pnpm >= 8 (or npm)

## Install and Build

```bash
git clone https://github.com/PhDCristian/OpenEdgeDSL.git
cd OpenEdgeDSL
pnpm install
pnpm -r build
```

## First Kernel

Create `hello.dsl`:

```openedge
target "uma-cgra-base";
let input = { 10, 20 };
let output @100 = { 0 };

kernel "hello" {
  cycle {
    at @0,0: R0 = input[0];
    at @0,1: R1 = input[1];
  }
  cycle {
    at @0,0: R2 = R0 + R1;
    at @0,1: output[0] = R2;
  }
}
```

## Compile

```bash
openedge emit hello.dsl -o hello.csv
```

## Validate and Analyze

```bash
openedge check hello.dsl
openedge analyze hello.dsl
```

## Authoring Rules

- Start every program with `target "...";`.
- Use `let` for constants, aliases, and arrays.
- Use canonical advanced statements such as `route(...)`, `reduce(...)`, and `scan(...)`.

## Next

- [Language Overview](/language/overview)
- [Features](/features/expressions)
- [Examples](/examples/basic)
