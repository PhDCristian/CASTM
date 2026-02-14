# Scan + Reduce + Allreduce

## What this demonstrates

- lane prefix computation with `std::scan(...)`,
- lane reduction with `std::reduce(...)`,
- global fanout with `std::allreduce(...)`.

## OpenEdgeDSL / CSV

::: code-group
<<< ./artifacts/scan.edsl{openedge} [OpenEdgeDSL]
<<< ./artifacts/scan.excerpt.csv{csv} [CSV (sim-matrix excerpt)]
:::

## Practical reading

- use `scan` for cumulative per-lane state.
- use `reduce` to aggregate per row/column.
- use `allreduce` when every PE must receive the aggregate.

Full generated CSV: `docs-site/examples/artifacts/scan.csv`.
