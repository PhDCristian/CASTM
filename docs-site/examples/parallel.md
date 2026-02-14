# Pipeline with Functions

## What this demonstrates

- reusable `function` blocks,
- explicit sequencing with `pipeline(...)`,
- deterministic call expansion order.

## OpenEdgeDSL / CSV

::: code-group
<<< ./artifacts/parallel.edsl{openedge} [OpenEdgeDSL]
<<< ./artifacts/parallel.excerpt.csv{csv} [CSV (sim-matrix excerpt)]
:::

## Practical reading

- stage functions keep kernels small and composable.
- `pipeline(...)` preserves lexical call order.
- lowering stays canonical (no legacy macro layer).

Full generated CSV: `docs-site/examples/artifacts/parallel.csv`.
