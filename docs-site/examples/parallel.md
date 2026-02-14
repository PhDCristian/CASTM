# Pipeline with Functions

## What this demonstrates

- reusable `function` blocks,
- explicit sequencing with `pipeline(...)`,
- deterministic call expansion order.

## Target and assumptions

- `target "uma-cgra-base";` is explicit in the linked snippet.
- default profile assumes `4x4` toroidal grid.
- CSV shown is generated from the exact snippet (no manual transcription).

## OpenEdgeDSL / CSV

::: code-group
<<< ../snippets/examples/parallel/01-main.edsl{openedge} [OpenEdgeDSL]
<<< ../snippets/examples/parallel/01-main.excerpt.csv{csv} [CSV (sim-matrix excerpt)]
:::

## Practical reading

- stage functions keep kernels small and composable.
- `pipeline(...)` preserves lexical call order.
- lowering stays canonical (no legacy macro layer).

Full generated CSV: `docs-site/snippets/examples/parallel/01-main.csv`.
