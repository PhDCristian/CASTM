# `std::allreduce(...)`

## When to use

Use when every PE needs the same reduced value after aggregation.

## Target and assumptions

All executable snippets below are canonical and explicit:

- `target base;`
- default grid: `4x4` toroidal profile unless overridden at compile time
- deterministic lowering: same source + options => same CSV

## Syntax

```text
std::allreduce(op=add|..., dest=Rd, src=Rs, axis=row|col);
```

## Parameters

| Parameter | Required | Description |
|---|---|---|
| `op` | yes | Reduction operation. |
| `dest` | yes | Destination register per PE. |
| `src` | yes | Source register per PE. |
| `axis` | no | Reduction axis (`row` default or `col`). |

## Case A — Minimal

::: code-group
<<< ../../snippets/pragmas/allreduce/01-minimal.castm{castm} [CASTM]
<<< ../../snippets/pragmas/allreduce/01-minimal.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/allreduce/01-minimal.csv`.

## Case B — Advanced options

::: code-group
<<< ../../snippets/pragmas/allreduce/02-advanced.castm{castm} [CASTM]
<<< ../../snippets/pragmas/allreduce/02-advanced.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/allreduce/02-advanced.csv`.

## Case C — Integration in kernel

::: code-group
<<< ../../snippets/pragmas/allreduce/04-integration.castm{castm} [CASTM]
<<< ../../snippets/pragmas/allreduce/04-integration.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/allreduce/04-integration.csv`.

## Case D — Edge / boundary

::: code-group
<<< ../../snippets/pragmas/allreduce/05-edge.castm{castm} [CASTM]
<<< ../../snippets/pragmas/allreduce/05-edge.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/allreduce/05-edge.csv`.

## Case E — Invalid usage

<<< ../../snippets/pragmas/allreduce/03-invalid.castm{castm-fail} [CASTM fail]

Expected: explicit diagnostic with source span and actionable hint.

## Lowering notes

Composes reduce + distribution phases with deterministic ordering.

## Related patterns

- Practical examples: [/examples/kernel-compaction](/examples/kernel-compaction)

- `std::reduce(...)` for non-distributed reduction
- `std::broadcast(...)` for source-based fan-out
