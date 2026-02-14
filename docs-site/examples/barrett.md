# Carry + Normalize + Conditional Sub

## What this demonstrates

- deterministic carry propagation (`std::carry_chain(...)`),
- lane normalization (`std::normalize(...)`),
- branchless modular correction (`std::conditional_sub(...)`).

## Target and assumptions

- `target "uma-cgra-base";` is explicit in the linked snippet.
- default profile assumes `4x4` toroidal grid.
- CSV shown is generated from the exact snippet (no manual transcription).

## OpenEdgeDSL / CSV

::: code-group
<<< ../snippets/examples/barrett/01-main.edsl{openedge} [OpenEdgeDSL]
<<< ../snippets/examples/barrett/01-main.excerpt.csv{csv} [CSV (sim-matrix excerpt)]
:::

## Practical reading

This composition is the core building block for Barrett-like multi-limb pipelines:

- carry in fixed width,
- normalize in-lane,
- final conditional subtraction without control-flow divergence.

Full generated CSV: `docs-site/snippets/examples/barrett/01-main.csv`.
