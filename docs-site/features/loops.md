# Loops

Canonical CASTM supports static and runtime `for` with explicit semantics.

## When to use

- Use static `for` for compile-time expansion.
- Use `unroll(k)`/`collapse(n)` on static loops for deterministic strategy control.
- Use runtime `for` with explicit control PE for hardware-controlled iteration.

## Target and assumptions

- Snippets use `target base;`.
- Static modifiers are valid only in static loops.
- CSV shown is generated from snippets.

## Case A — Static loop

::: code-group
<<< ../snippets/features/loops/01-static.castm{castm} [CASTM]
<<< ../snippets/features/loops/01-static.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/features/loops/01-static.csv`.

## Case B — Static loop with `unroll`

::: code-group
<<< ../snippets/features/loops/02-unroll.castm{castm} [CASTM]
<<< ../snippets/features/loops/02-unroll.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/features/loops/02-unroll.csv`.

## Case C — Nested static loops with `collapse`

::: code-group
<<< ../snippets/features/loops/03-collapse.castm{castm} [CASTM]
<<< ../snippets/features/loops/03-collapse.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/features/loops/03-collapse.csv`.

## Case D — Runtime loop

::: code-group
<<< ../snippets/features/loops/04-runtime.castm{castm} [CASTM]
<<< ../snippets/features/loops/04-runtime.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/features/loops/04-runtime.csv`.

## Case E — Combined static strategy (`unroll + collapse`)

::: code-group
<<< ../snippets/features/loops/05-combined.castm{castm} [CASTM]
<<< ../snippets/features/loops/05-combined.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/features/loops/05-combined.csv`.

## Case F — Invalid runtime + static modifier mix

<<< ../snippets/features/loops/06-invalid.castm{castm-fail} [CASTM fail]

Expected diagnostic: `E2002`.

## Related examples

- [/examples/loops](/examples/loops)
- [/examples/loop-strategies](/examples/loop-strategies)
