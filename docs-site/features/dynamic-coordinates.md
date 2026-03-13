# Dynamic Coordinates in Loops

Computed coordinates are valid canonical syntax when expressions resolve through loop bindings.

## When to use

- Use dynamic coordinates when index mapping is derived from loop variables.
- Prefer this over manual 16-placement expansion for full-grid patterns.

## Target and assumptions

- Snippets use `target base;`.
- Coordinate expressions must resolve after loop expansion.
- CSV shown is generated from snippets.

## Case A — Full-grid mapping with `@k/4,k%4`

::: code-group
<<< ../snippets/features/dynamic-coordinates/01-for-grid.castm{castm} [CASTM]
<<< ../snippets/features/dynamic-coordinates/01-for-grid.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/features/dynamic-coordinates/01-for-grid.csv`.

## Case B — Nested loop bindings (`@r,c`)

::: code-group
<<< ../snippets/features/dynamic-coordinates/02-for-row-col.castm{castm} [CASTM]
<<< ../snippets/features/dynamic-coordinates/02-for-row-col.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/features/dynamic-coordinates/02-for-row-col.csv`.

## Case C — Short-point with dynamic column

::: code-group
<<< ../snippets/features/dynamic-coordinates/03-short-point.castm{castm} [CASTM]
<<< ../snippets/features/dynamic-coordinates/03-short-point.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/features/dynamic-coordinates/03-short-point.csv`.

## Case D — Mixed dynamic + range

::: code-group
<<< ../snippets/features/dynamic-coordinates/04-with-range.castm{castm} [CASTM]
<<< ../snippets/features/dynamic-coordinates/04-with-range.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/features/dynamic-coordinates/04-with-range.csv`.

## Case E — Parenthesized dynamic expressions

::: code-group
<<< ../snippets/features/dynamic-coordinates/05-nested-expression.castm{castm} [CASTM]
<<< ../snippets/features/dynamic-coordinates/05-nested-expression.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/features/dynamic-coordinates/05-nested-expression.csv`.

## Case F — Invalid unresolved dynamic coordinate

<<< ../snippets/features/dynamic-coordinates/06-invalid.castm{castm-fail} [CASTM fail]

Expected diagnostic: `E3011`.

## Related examples

- [/examples/loops](/examples/loops)
- [/features/coordinate-expressions](/features/coordinate-expressions)
