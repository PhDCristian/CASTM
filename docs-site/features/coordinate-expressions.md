# Coordinate Expressions

Canonical placements accept expressions and ranges in coordinates.

## When to use

- Use expression coordinates for loop-bound placement (`@0,i`, `@k/4,k%4`).
- Use ranges for concise rectangular placement (`@0,0..3`, `@0..1,0..1`).

## Target and assumptions

- Snippets use `target "uma-cgra-base";`.
- Range expansion is inclusive.
- Unresolved coordinates are rejected during semantic/lowering stage.

## Case A — Expression coordinate with loop binding

::: code-group
<<< ../snippets/features/coordinate-expressions/01-expression.edsl{openedge} [OpenEdgeDSL]
<<< ../snippets/features/coordinate-expressions/01-expression.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/features/coordinate-expressions/01-expression.csv`.

## Case B — Computed coordinates (`k/4`, `k%4`)

::: code-group
<<< ../snippets/features/coordinate-expressions/02-computed.edsl{openedge} [OpenEdgeDSL]
<<< ../snippets/features/coordinate-expressions/02-computed.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/features/coordinate-expressions/02-computed.csv`.

## Case C — Row range

::: code-group
<<< ../snippets/features/coordinate-expressions/03-range-row.edsl{openedge} [OpenEdgeDSL]
<<< ../snippets/features/coordinate-expressions/03-range-row.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/features/coordinate-expressions/03-range-row.csv`.

## Case D — Column range

::: code-group
<<< ../snippets/features/coordinate-expressions/04-range-col.edsl{openedge} [OpenEdgeDSL]
<<< ../snippets/features/coordinate-expressions/04-range-col.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/features/coordinate-expressions/04-range-col.csv`.

## Case E — Rectangular range

::: code-group
<<< ../snippets/features/coordinate-expressions/05-range-rect.edsl{openedge} [OpenEdgeDSL]
<<< ../snippets/features/coordinate-expressions/05-range-rect.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/features/coordinate-expressions/05-range-rect.csv`.

## Case F — Invalid unresolved coordinate

<<< ../snippets/features/coordinate-expressions/06-invalid.edsl{openedge-fail} [OpenEdgeDSL fail]

Expected diagnostic: `E3011`.

## Related examples

- [/examples/loops](/examples/loops)
- [/features/spatial-short-forms](/features/spatial-short-forms)
