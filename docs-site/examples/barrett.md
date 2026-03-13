# Carry + Normalize + Conditional Sub

## What this demonstrates

- deterministic carry propagation (`std::carry_chain(...)`),
- lane normalization (`std::normalize(...)`),
- branchless modular correction (`std::conditional_sub(...)`).

## When to use

Use this when you need a canonical multi-limb arithmetic backbone for modular reduction style kernels.

## Target and assumptions

- `target base;` is explicit in the linked snippet.
- default profile assumes `4x4` toroidal grid.
- CSV shown is generated from the exact snippet (no manual transcription).

## CASTM ↔ CSV

::: code-group
<<< ../snippets/examples/barrett/01-main.castm{castm} [CASTM]
<<< ../snippets/examples/barrett/01-main.excerpt.csv{csv} [CSV (sim-matrix excerpt)]
:::

## Why this CSV looks like this

This composition is the core building block for Barrett-like multi-limb pipelines:

- carry in fixed width,
- normalize in-lane,
- final conditional subtraction without control-flow divergence.

Full generated CSV: `docs-site/snippets/examples/barrett/01-main.csv`.

## Related features

- [/features/pragmas/carry-chain](/features/pragmas/carry-chain)
- [/features/pragmas/normalize](/features/pragmas/normalize)
- [/features/pragmas/conditional-sub](/features/pragmas/conditional-sub)

## Continue

- Next: [/examples/fft](/examples/fft)
- All examples: [/examples](/examples/index)
