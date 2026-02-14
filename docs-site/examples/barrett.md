# Carry + Normalize + Conditional Sub

## What this demonstrates

- deterministic carry propagation (`std::carry_chain(...)`),
- lane normalization (`std::normalize(...)`),
- branchless modular correction (`std::conditional_sub(...)`).

## OpenEdgeDSL / CSV

::: code-group
<<< ./artifacts/barrett.edsl{openedge} [OpenEdgeDSL]
<<< ./artifacts/barrett.excerpt.csv{csv} [CSV (sim-matrix excerpt)]
:::

## Practical reading

This composition is the core building block for Barrett-like multi-limb pipelines:

- carry in fixed width,
- normalize in-lane,
- final conditional subtraction without control-flow divergence.

Full generated CSV: `docs-site/examples/artifacts/barrett.csv`.
