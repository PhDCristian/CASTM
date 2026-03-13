# Memory Sugar

Canonical memory sugar is available inside `bundle {}` and lowers to existing `LWI/SWI`.

## When to use

- Prefer `R = A[i]` and `A[i] = R` for readable load/store code.
- Use raw addresses (`[expr]`) for explicit memory-mapped flows.

## Target and assumptions

- Snippets use `target base;`.
- Address expressions are compile-time resolved.
- CSV shown is generated from snippets.

## Case A — Minimal array load

::: code-group
<<< ../snippets/features/memory-sugar/01-minimal.castm{castm} [CASTM]
<<< ../snippets/features/memory-sugar/01-minimal.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/features/memory-sugar/01-minimal.csv`.

## Case B — Mixed load/store + raw address

::: code-group
<<< ../snippets/features/memory-sugar/02-advanced.castm{castm} [CASTM]
<<< ../snippets/features/memory-sugar/02-advanced.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/features/memory-sugar/02-advanced.csv`.

## Case C — 2D array indexing

::: code-group
<<< ../snippets/features/memory-sugar/03-2d.castm{castm} [CASTM]
<<< ../snippets/features/memory-sugar/03-2d.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/features/memory-sugar/03-2d.csv`.

## Case D — Raw address read/write

::: code-group
<<< ../snippets/features/memory-sugar/04-raw-address.castm{castm} [CASTM]
<<< ../snippets/features/memory-sugar/04-raw-address.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/features/memory-sugar/04-raw-address.csv`.

## Case E — Short-point inline placements

::: code-group
<<< ../snippets/features/memory-sugar/05-short-point.castm{castm} [CASTM]
<<< ../snippets/features/memory-sugar/05-short-point.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/features/memory-sugar/05-short-point.csv`.

## Case F — Invalid memory-to-memory assignment

<<< ../snippets/features/memory-sugar/06-invalid.castm{castm-fail} [CASTM fail]

Expected diagnostic: `E3001`.

## Related examples

- [/examples/basic](/examples/basic)
- [/examples/kernel-compaction](/examples/kernel-compaction)
