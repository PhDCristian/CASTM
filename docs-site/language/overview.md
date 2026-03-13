# Language Overview

CASTM uses a single canonical syntax profile.

## Design Goals

- deterministic lowering to ISA-compatible CSV
- explicit spatial-temporal intent
- composable high-level statements without backend format changes
- typed diagnostics with phase-aware artifacts

## Canonical Surface

| Area | Canonical Forms |
|---|---|
| declarations | `let` |
| spatial placement | `at @r,c`, `at row`, `at col`, `at all` |
| control-flow | `if`, `while`, `for`, runtime `for`, `break`/`continue` (optionally labeled), static modifiers `unroll(k)` / `collapse(n)` |
| composition | `function`, `pipeline(...)` |
| advanced operations | `std::route(...)`, `std::reduce(...)`, `std::scan(...)`, `std::collect(...)`, `std::carry_chain(...)`, ... |
| source config + runtime | `build { ... }`, `io.load(...)`, `io.store(...)`, `limit(...)`, `assert(...)` |

## Target Alias

- Canonical docs use `target base;`.
- `base` resolves internally to the baseline profile ID.
- This keeps source clean while preserving deterministic compilation.

## Minimal Program (Executable)

```castm
target base;
build {
  optimize O2;
}
let A = { 1, 2, 3, 4 };

kernel "overview" {
  std::route(@0,1 -> @0,0, payload=R3, accum=R1);
  bundle {
    at @0,0: R0 = A[0];
    at row 1: NOP;
  }
}
```

## What This Gives You

- direct mapping from high-level intent to deterministic CSV output
- predictable cycle ordering and lowering
- typed compilation artifacts for tooling and debugging (`structuredAst`, `ast`, `hir`, `mir`, `lir`, `csv`)

## References

- [Program Structure](/language/program-structure)
- [Configuration in Source](/language/configuration)
- [Target Profiles](/language/target-profiles)
- [Compilation Pipeline](/language/compilation)
- [DSL to CSV Equivalence](/language/dsl-csv-equivalence)
- [Formal Grammar](/language/grammar)


## CASTM ↔ CSV

::: code-group
<<< ../snippets/language/overview/01-main.castm{castm} [CASTM]
<<< ../snippets/language/overview/01-main.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/language/overview/01-main.csv`.
