# Expressions

Canonical CASTM supports C-like assignment expressions that lower deterministically to ISA operations.

## When to use

- Use expression sugar for readability (`R2 = R0 + R1`) instead of raw opcodes when possible.
- Use inline arithmetic in operands when compile-time foldable.

## Target and assumptions

- Snippets use `target base;`.
- Lowering is deterministic for fixed source/options.
- CSV shown is generated automatically from snippets.

## Case A — Minimal arithmetic assignment

::: code-group
<<< ../snippets/features/expressions/01-minimal.castm{castm} [CASTM]
<<< ../snippets/features/expressions/01-minimal.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/features/expressions/01-minimal.csv`.

## Case B — Bit and mask operations

::: code-group
<<< ../snippets/features/expressions/02-advanced.castm{castm} [CASTM]
<<< ../snippets/features/expressions/02-advanced.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/features/expressions/02-advanced.csv`.

## Case C — Inline arithmetic folding in operands

::: code-group
<<< ../snippets/features/expressions/03-inline-arith.castm{castm} [CASTM]
<<< ../snippets/features/expressions/03-inline-arith.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/features/expressions/03-inline-arith.csv`.

## Case D — Function integration with expressions

::: code-group
<<< ../snippets/features/expressions/04-integration.castm{castm} [CASTM]
<<< ../snippets/features/expressions/04-integration.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/features/expressions/04-integration.csv`.

## Case E — Edge operators and constants

::: code-group
<<< ../snippets/features/expressions/05-edge.castm{castm} [CASTM]
<<< ../snippets/features/expressions/05-edge.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/features/expressions/05-edge.csv`.

## Case F — Invalid memory-to-memory assignment

<<< ../snippets/features/expressions/06-invalid.castm{castm-fail} [CASTM fail]

Expected diagnostic: `E3001`.

## Related examples

- [/examples/basic](/examples/basic)
- [/examples/barrett](/examples/barrett)
