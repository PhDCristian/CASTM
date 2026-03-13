# Scan + Reduce + Allreduce

## What this demonstrates

- lane prefix computation with `std::scan(...)`,
- lane reduction with `std::reduce(...)`,
- global fanout with `std::allreduce(...)`.

## When to use

Use this when you need lane-wise prefix and reduction collectives instead of manual route chains.

## Target and assumptions

- `target base;` is explicit in the linked snippet.
- default profile assumes `4x4` toroidal grid.
- CSV shown is generated from the exact snippet (no manual transcription).

## CASTM ↔ CSV

::: code-group
<<< ../snippets/examples/scan/01-main.castm{castm} [CASTM]
<<< ../snippets/examples/scan/01-main.excerpt.csv{csv} [CSV (sim-matrix excerpt)]
:::

## Why this CSV looks like this

- use `scan` for cumulative per-lane state.
- use `reduce` to aggregate per row/column.
- use `allreduce` when every PE must receive the aggregate.

Full generated CSV: `docs-site/snippets/examples/scan/01-main.csv`.

## Related features

- [/features/pragmas/scan](/features/pragmas/scan)
- [/features/pragmas/reduce](/features/pragmas/reduce)
- [/features/pragmas/allreduce](/features/pragmas/allreduce)

## Continue

- Next: [/examples/stencil](/examples/stencil)
- All examples: [/examples](/examples/index)
