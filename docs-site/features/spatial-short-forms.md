# Spatial Short Forms

Canonical spatial syntax supports concise point placements and row-segment payloads without reintroducing legacy namespace forms.

## When to use

- Use short point form `@r,c:` for compact direct placements.
- Use `at row N: a | b | c | d` when you want explicit per-column row segments.
- Keep `row N:` (without `at`) out of source; it is intentionally invalid in canonical mode.

## Target and assumptions

- Every snippet includes `target base;`.
- Default grid is `4x4` torus.
- CSV shown is generated from snippets (no manual transcription).

## Case A — Short point placement

::: code-group
<<< ../snippets/features/spatial-short-forms/01-short-point.castm{castm} [CASTM]
<<< ../snippets/features/spatial-short-forms/01-short-point.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/features/spatial-short-forms/01-short-point.csv`.

## Case B — Multiple short placements in one cycle line

::: code-group
<<< ../snippets/features/spatial-short-forms/02-multi-short.castm{castm} [CASTM]
<<< ../snippets/features/spatial-short-forms/02-multi-short.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/features/spatial-short-forms/02-multi-short.csv`.

## Case C — Row segmented payload with pipes

::: code-group
<<< ../snippets/features/spatial-short-forms/03-row-segment.castm{castm} [CASTM]
<<< ../snippets/features/spatial-short-forms/03-row-segment.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/features/spatial-short-forms/03-row-segment.csv`.

## Case D — Row auto-broadcast

::: code-group
<<< ../snippets/features/spatial-short-forms/04-row-broadcast.castm{castm} [CASTM]
<<< ../snippets/features/spatial-short-forms/04-row-broadcast.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/features/spatial-short-forms/04-row-broadcast.csv`.

## Case E — Mixed canonical forms

::: code-group
<<< ../snippets/features/spatial-short-forms/05-mixed.castm{castm} [CASTM]
<<< ../snippets/features/spatial-short-forms/05-mixed.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/features/spatial-short-forms/05-mixed.csv`.

## Case F — Invalid legacy-style row namespace

<<< ../snippets/features/spatial-short-forms/06-invalid.castm{castm-fail} [CASTM fail]

Expected diagnostic: `E2002`.

## Related patterns

- [/features/coordinate-expressions](/features/coordinate-expressions)
- [/features/dynamic-coordinates](/features/dynamic-coordinates)
- [/features/broadcast-syntax](/features/broadcast-syntax)
- [/examples/basic](/examples/basic)
- [/examples/kernel-compaction](/examples/kernel-compaction)
