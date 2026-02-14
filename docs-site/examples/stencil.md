# Stencil + Guard + Triangle

## What this demonstrates

- neighborhood pattern (`std::stencil(...)`),
- predicate-based activation (`std::guard(...)`),
- geometric masks (`std::triangle(...)`).

## OpenEdgeDSL / CSV

::: code-group
<<< ./artifacts/stencil.edsl{openedge} [OpenEdgeDSL]
<<< ./artifacts/stencil.excerpt.csv{csv} [CSV (sim-matrix excerpt)]
:::

## Practical reading

- `stencil` emits neighborhood communication.
- `guard` keeps only valid/desired PE placements.
- `triangle` maps algebra to upper/lower matrix regions deterministically.

Full generated CSV: `docs-site/examples/artifacts/stencil.csv`.
