# Loops: Static and Runtime

## What this demonstrates

- static `for` unrolled at compile time,
- computed coordinates (`@k/4,k%4`),
- runtime loop with explicit control PE.

## Target and assumptions

- `target "uma-cgra-base";` is explicit in the linked snippet.
- default profile assumes `4x4` toroidal grid.
- CSV shown is generated from the exact snippet (no manual transcription).

## OpenEdgeDSL / CSV

::: code-group
<<< ../snippets/examples/loops/01-main.edsl{openedge} [OpenEdgeDSL]
<<< ../snippets/examples/loops/01-main.excerpt.csv{csv} [CSV (sim-matrix excerpt)]
:::

## Practical reading

- first loop: explicit lane-by-lane expansion.
- second loop: compact full-grid coverage with coordinate expressions.
- third loop: runtime control remains explicit (`at @0,0 runtime`).

The full output includes additional cycles for computed-coordinate expansion and runtime-loop control flow.
Full generated CSV: `docs-site/snippets/examples/loops/01-main.csv`.
