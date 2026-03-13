# Loops: Static and Runtime

## What this demonstrates

- static `for` unrolled at compile time,
- computed coordinates (`@k/4,k%4`),
- runtime loop with explicit control PE.

## When to use

Use this page when you need to choose between static expansion and runtime loop control.

## Target and assumptions

- `target base;` is explicit in the linked snippet.
- default profile assumes `4x4` toroidal grid.
- CSV shown is generated from the exact snippet (no manual transcription).

## CASTM ↔ CSV

::: code-group
<<< ../snippets/examples/loops/01-main.castm{castm} [CASTM]
<<< ../snippets/examples/loops/01-main.excerpt.csv{csv} [CSV (sim-matrix excerpt)]
:::

## Why this CSV looks like this

- first loop: explicit lane-by-lane expansion.
- second loop: compact full-grid coverage with coordinate expressions.
- third loop: runtime control remains explicit (`at @0,0 runtime`).

The full output includes additional cycles for computed-coordinate expansion and runtime-loop control flow.
Full generated CSV: `docs-site/snippets/examples/loops/01-main.csv`.

## Related features

- [/features/loops](/features/loops)
- [/features/coordinate-expressions](/features/coordinate-expressions)
- [/features/dynamic-coordinates](/features/dynamic-coordinates)

## Continue

- Next: [/examples/loop-strategies](/examples/loop-strategies)
- All examples: [/examples](/examples/index)
