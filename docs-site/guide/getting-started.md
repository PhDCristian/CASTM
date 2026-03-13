---
title: Getting Started
outline: deep
---

# Getting Started

CASTM uses canonical syntax and compiles deterministically to CSV for CGRA flows.

## Prerequisites

- Node.js >= 18
- pnpm >= 8 (or npm)

## Install and Build

```bash
git clone https://github.com/PhDCristian/CASTM.git
cd CASTM
pnpm install
pnpm -r build
```

## First Kernel

Create `hello.castm`:

```castm
target base;
let input = { 10, 20 };
let output @100 = { 0 };

kernel "hello" {
  bundle {
    at @0,0: R0 = input[0];
    at @0,1: R1 = input[1];
  }
  bundle {
    at @0,0: R2 = R0 + R1;
    at @0,1: output[0] = R2;
  }
}
```

`target base;` is the canonical user-facing alias for the default CGRA profile.
You do not need to remember internal profile IDs.

## Compile

```bash
castm emit hello.castm -o hello.csv
```

## Validate and Analyze

```bash
castm check hello.castm
castm analyze hello.castm
```

## Authoring Rules

- Start every program with `target base;` (or another valid target alias).
- Use `let` for constants, aliases, and arrays.
- Use canonical advanced statements such as `route(...)`, `reduce(...)`, and `scan(...)`.

## Next

- [Language Overview](/language/overview)
- [Configuration in Source](/language/configuration)
- [Features](/features/expressions)
- [Examples](/examples/basic)


## CASTM ↔ CSV

::: code-group
<<< ../snippets/guide/getting-started/01-main.castm{castm} [CASTM]
<<< ../snippets/guide/getting-started/01-main.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/guide/getting-started/01-main.csv`.
