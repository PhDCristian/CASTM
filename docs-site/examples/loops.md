# Loops: Static and Runtime

## What this demonstrates

- static `for` unrolled at compile time,
- computed coordinates (`@k/4,k%4`),
- runtime loop with explicit control PE.

## OpenEdgeDSL / CSV

::: code-group
<<< ./artifacts/loops.edsl{openedge} [OpenEdgeDSL]
<<< ./artifacts/loops.excerpt.csv{csv} [CSV (sim-matrix excerpt)]
:::

## Practical reading

- first loop: explicit lane-by-lane expansion.
- second loop: compact full-grid coverage with coordinate expressions.
- third loop: runtime control remains explicit (`at @0,0 runtime`).

The full output includes additional cycles for computed-coordinate expansion and runtime-loop control flow.
Full generated CSV: `docs-site/examples/artifacts/loops.csv`.
