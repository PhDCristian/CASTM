# Loop Expansion Model

## When to use

Use `unroll(k)` and `collapse(n)` to control static loop expansion strategy explicitly.

## Target and assumptions

All executable snippets below are canonical and explicit:

- `target base;`
- default grid: `4x4` toroidal profile unless overridden at compile time
- deterministic lowering: same source + options => same CSV

## Syntax

```text
for i in range(0, N) unroll(k) { ... }
for r in range(0, R) collapse(n) { ... }
```

## Parameters

| Parameter | Required | Description |
|---|---|---|
| `unroll(k)` | optional | Expand static loop body by factor `k`. |
| `collapse(n)` | optional | Flatten `n` nested static loops. |
| `constraints` | implicit | Runtime loops do not accept static modifiers. |

## Case A — Minimal

::: code-group
<<< ../../snippets/pragmas/unroll/01-minimal.castm{castm} [CASTM]
<<< ../../snippets/pragmas/unroll/01-minimal.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/unroll/01-minimal.csv`.

## Case B — Advanced options

::: code-group
<<< ../../snippets/pragmas/unroll/02-advanced.castm{castm} [CASTM]
<<< ../../snippets/pragmas/unroll/02-advanced.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/unroll/02-advanced.csv`.

## Case C — Integration in kernel

::: code-group
<<< ../../snippets/pragmas/unroll/04-integration.castm{castm} [CASTM]
<<< ../../snippets/pragmas/unroll/04-integration.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/unroll/04-integration.csv`.

## Case D — Edge / boundary

::: code-group
<<< ../../snippets/pragmas/unroll/05-edge.castm{castm} [CASTM]
<<< ../../snippets/pragmas/unroll/05-edge.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/unroll/05-edge.csv`.

## Case E — Invalid usage

<<< ../../snippets/pragmas/unroll/03-invalid.castm{castm-fail} [CASTM fail]

Expected: explicit diagnostic with source span and actionable hint.

## Lowering notes

`unroll` and `collapse` affect expansion order only; final lowering remains deterministic.

## Related patterns

- Practical examples: [/examples/kernel-compaction](/examples/kernel-compaction)

- Loop Composition Patterns (`parallel` page)
- Scheduler profiles in `/examples/scheduler-modes`
