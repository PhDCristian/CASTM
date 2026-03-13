# Functions

Functions are canonical reusable blocks and expand deterministically at call sites.

## When to use

- Encapsulate repeated cycle patterns.
- Keep kernels readable with named stages.
- Use `pipeline(...)` for explicit ordered staging.

## Target and assumptions

- Snippets use `target base;`.
- Function expansion preserves lexical call order.
- CSV shown is generated from snippets.

## Case A — Basic function call

::: code-group
<<< ../snippets/features/functions/01-basic-call.castm{castm} [CASTM]
<<< ../snippets/features/functions/01-basic-call.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/features/functions/01-basic-call.csv`.

## Case B — Parameterized function body

::: code-group
<<< ../snippets/features/functions/02-params.castm{castm} [CASTM]
<<< ../snippets/features/functions/02-params.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/features/functions/02-params.csv`.

## Case C — Multi-function composition

::: code-group
<<< ../snippets/features/functions/03-nested-call.castm{castm} [CASTM]
<<< ../snippets/features/functions/03-nested-call.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/features/functions/03-nested-call.csv`.

## Case D — `pipeline(...)` with functions

::: code-group
<<< ../snippets/features/functions/04-pipeline.castm{castm} [CASTM]
<<< ../snippets/features/functions/04-pipeline.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/features/functions/04-pipeline.csv`.

## Case E — Short-point function body placements

::: code-group
<<< ../snippets/features/functions/05-short-point.castm{castm} [CASTM]
<<< ../snippets/features/functions/05-short-point.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/features/functions/05-short-point.csv`.

## Case F — Invalid undefined function call

<<< ../snippets/features/functions/06-invalid.castm{castm-fail} [CASTM fail]

Expected diagnostic: `E2002`.

## Related examples

- [/examples/parallel](/examples/parallel)
- [/features/pragmas/pipeline](/features/pragmas/pipeline)
