# Language Overview

OpenEdgeDSL uses a single canonical syntax profile.

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
| control-flow | `if`, `while`, `for`, runtime `for`, static modifiers `unroll(k)` / `collapse(n)` |
| composition | `function`, `pipeline(...)` |
| advanced operations | `std::route(...)`, `std::reduce(...)`, `std::scan(...)`, `std::collect(...)`, `std::carry_chain(...)`, ... |
| runtime directives | `.io_load`, `.io_store`, `.limit`, `.assert` |

## Minimal Program (Executable)

```openedge
target "uma-cgra-base";
let A = { 1, 2, 3, 4 };

kernel "overview" {
  std::route(@0,1 -> @0,0, payload=R3, accum=R1);
  cycle {
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
- [Compilation Pipeline](/language/compilation)
- [DSL to CSV Equivalence](/language/dsl-csv-equivalence)
- [Formal Grammar](/language/grammar)


## OpenEdgeDSL ↔ CSV

::: code-group
<<< ../snippets/language/overview/01-main.edsl{openedge} [OpenEdgeDSL]
<<< ../snippets/language/overview/01-main.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/language/overview/01-main.csv`.
