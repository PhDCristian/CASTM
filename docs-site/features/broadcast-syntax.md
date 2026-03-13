# Row/Col/All Spatial Expansion

Canonical spatial scopes support concise full-row, full-column, and full-grid placement.

## When to use

- Use `at row N:` for row-wide operations.
- Use row segmented form with `|` for explicit per-column payload.
- Use `at col N:` and `at all:` for scope-based expansion.

## Target and assumptions

- Snippets use `target base;`.
- `at row N: INSTR;` auto-broadcasts when one instruction is provided.
- `row N:` without `at` is intentionally invalid.

## Case A — Row auto-broadcast

::: code-group
<<< ../snippets/features/broadcast-syntax/01-row-single.castm{castm} [CASTM]
<<< ../snippets/features/broadcast-syntax/01-row-single.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/features/broadcast-syntax/01-row-single.csv`.

## Case B — Row segmented payload with `|`

::: code-group
<<< ../snippets/features/broadcast-syntax/02-row-segment.castm{castm} [CASTM]
<<< ../snippets/features/broadcast-syntax/02-row-segment.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/features/broadcast-syntax/02-row-segment.csv`.

## Case C — Column expansion

::: code-group
<<< ../snippets/features/broadcast-syntax/03-col-single.castm{castm} [CASTM]
<<< ../snippets/features/broadcast-syntax/03-col-single.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/features/broadcast-syntax/03-col-single.csv`.

## Case D — Full-grid expansion

::: code-group
<<< ../snippets/features/broadcast-syntax/04-all-single.castm{castm} [CASTM]
<<< ../snippets/features/broadcast-syntax/04-all-single.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/features/broadcast-syntax/04-all-single.csv`.

## Case E — Short-point multi-placement in one line

::: code-group
<<< ../snippets/features/broadcast-syntax/05-short-point-multi.castm{castm} [CASTM]
<<< ../snippets/features/broadcast-syntax/05-short-point-multi.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/features/broadcast-syntax/05-short-point-multi.csv`.

## Case F — Invalid row namespace without `at`

<<< ../snippets/features/broadcast-syntax/06-invalid.castm{castm-fail} [CASTM fail]

Expected diagnostic: `E2002`.

## Related examples

- [/examples/kernel-compaction](/examples/kernel-compaction)
- [/features/spatial-short-forms](/features/spatial-short-forms)
