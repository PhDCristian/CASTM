# Scan + Reduce + Allreduce

## What this demonstrates

- lane prefix computation with `std::scan(...)`,
- lane reduction with `std::reduce(...)`,
- global fanout with `std::allreduce(...)`.

## Target and assumptions

- `target "uma-cgra-base";` is explicit in the linked snippet.
- default profile assumes `4x4` toroidal grid.
- CSV shown is generated from the exact snippet (no manual transcription).

## OpenEdgeDSL / CSV

::: code-group
<<< ../snippets/examples/scan/01-main.edsl{openedge} [OpenEdgeDSL]
<<< ../snippets/examples/scan/01-main.excerpt.csv{csv} [CSV (sim-matrix excerpt)]
:::

## Practical reading

- use `scan` for cumulative per-lane state.
- use `reduce` to aggregate per row/column.
- use `allreduce` when every PE must receive the aggregate.

Full generated CSV: `docs-site/snippets/examples/scan/01-main.csv`.
