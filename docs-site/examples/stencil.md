# Stencil + Guard + Triangle

## What this demonstrates

- neighborhood pattern (`std::stencil(...)`),
- predicate-based activation (`std::guard(...)`),
- geometric masks (`std::triangle(...)`).

## When to use

Use this when neighborhood access, masking, and region predicates must be expressed as deterministic spatial transforms.

## Target and assumptions

- `target "uma-cgra-base";` is explicit in the linked snippet.
- default profile assumes `4x4` toroidal grid.
- CSV shown is generated from the exact snippet (no manual transcription).

## OpenEdgeDSL ↔ CSV

::: code-group
<<< ../snippets/examples/stencil/01-main.edsl{openedge} [OpenEdgeDSL]
<<< ../snippets/examples/stencil/01-main.excerpt.csv{csv} [CSV (sim-matrix excerpt)]
:::

## Why this CSV looks like this

- `stencil` emits neighborhood communication.
- `guard` keeps only valid/desired PE placements.
- `triangle` maps algebra to upper/lower matrix regions deterministically.

Full generated CSV: `docs-site/snippets/examples/stencil/01-main.csv`.

## Related features

- [/features/pragmas/stencil](/features/pragmas/stencil)
- [/features/pragmas/guard](/features/pragmas/guard)
- [/features/pragmas/triangle](/features/pragmas/triangle)

## Continue

- Next: [/examples/barrett](/examples/barrett)
- All examples: [/examples](/examples/index)
