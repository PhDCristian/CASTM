# Pipeline with Functions

## What this demonstrates

- reusable `function` blocks,
- explicit sequencing with `pipeline(...)`,
- deterministic call expansion order.

## When to use

Use this when a kernel can be split into named stages and you want readable sequencing with stable lowering order.

## Target and assumptions

- `target base;` is explicit in the linked snippet.
- default profile assumes `4x4` toroidal grid.
- CSV shown is generated from the exact snippet (no manual transcription).

## CASTM ↔ CSV

::: code-group
<<< ../snippets/examples/parallel/01-main.castm{castm} [CASTM]
<<< ../snippets/examples/parallel/01-main.excerpt.csv{csv} [CSV (sim-matrix excerpt)]
:::

## Why this CSV looks like this

- stage functions keep kernels small and composable.
- `pipeline(...)` preserves lexical call order.
- lowering stays canonical (no legacy macro layer).

Full generated CSV: `docs-site/snippets/examples/parallel/01-main.csv`.

## Related features

- [/features/functions](/features/functions)
- [/features/pragmas/pipeline](/features/pragmas/pipeline)
- [/features/loops](/features/loops)

## Continue

- Next: [/examples/scan](/examples/scan)
- All examples: [/examples](/examples/index)
