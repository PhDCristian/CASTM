# Loop Composition Patterns

## When to use

Use canonical static/runtime loop composition to express parallel intent without legacy pragmas.

## Target and assumptions

All executable snippets below are canonical and explicit:

- `target base;`
- default grid: `4x4` toroidal profile unless overridden at compile time
- deterministic lowering: same source + options => same CSV

## Syntax

```text
for i in range(0, N) { ... }
for r in range(0, R) collapse(2) { for c in range(0, C) { ... } }
```

## Parameters

| Parameter | Required | Description |
|---|---|---|
| `unroll(k)` | optional | Static chunk expansion. |
| `collapse(n)` | optional | Flatten nested static loops. |
| `runtime` | optional | Explicit hardware-controlled runtime loop form. |

## Case A — Minimal

::: code-group
<<< ../../snippets/pragmas/parallel/01-minimal.castm{castm} [CASTM]
<<< ../../snippets/pragmas/parallel/01-minimal.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/parallel/01-minimal.csv`.

## Case B — Advanced options

::: code-group
<<< ../../snippets/pragmas/parallel/02-advanced.castm{castm} [CASTM]
<<< ../../snippets/pragmas/parallel/02-advanced.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/parallel/02-advanced.csv`.

## Case C — Integration in kernel

::: code-group
<<< ../../snippets/pragmas/parallel/04-integration.castm{castm} [CASTM]
<<< ../../snippets/pragmas/parallel/04-integration.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/parallel/04-integration.csv`.

## Case D — Edge / boundary

::: code-group
<<< ../../snippets/pragmas/parallel/05-edge.castm{castm} [CASTM]
<<< ../../snippets/pragmas/parallel/05-edge.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/parallel/05-edge.csv`.

## Case E — Invalid usage

<<< ../../snippets/pragmas/parallel/03-invalid.castm{castm-fail} [CASTM fail]

Expected: explicit diagnostic with source span and actionable hint.

## Lowering notes

Loop strategy modifiers are resolved at compile time with deterministic ordering and diagnostics.

## Related patterns

- Practical examples: [/examples/kernel-compaction](/examples/kernel-compaction)

- Loop Expansion Model (`unroll` page)
- Control flow examples in `/examples/for-control-flow`
