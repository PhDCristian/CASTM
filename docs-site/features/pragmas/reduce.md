# `std::reduce(...)`

## When to use

Use axis reduction when all lane values must be combined into a destination register.

## Target and assumptions

All executable snippets below are canonical and explicit:

- `target base;`
- default grid: `4x4` toroidal profile unless overridden at compile time
- deterministic lowering: same source + options => same CSV

## Syntax

```text
std::reduce(op=add|xor|..., dest=Rd, src=Rs, axis=row|col);
```

## Parameters

| Parameter | Required | Description |
|---|---|---|
| `op` | yes | Reduction operation. |
| `dest` | yes | Destination register. |
| `src` | yes | Source register. |
| `axis` | no | Reduction axis (`row` default, or `col`). |

## Case A — Minimal

::: code-group
<<< ../../snippets/pragmas/reduce/01-minimal.castm{castm} [CASTM]
<<< ../../snippets/pragmas/reduce/01-minimal.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/reduce/01-minimal.csv`.

## Case B — Advanced options

::: code-group
<<< ../../snippets/pragmas/reduce/02-advanced.castm{castm} [CASTM]
<<< ../../snippets/pragmas/reduce/02-advanced.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/reduce/02-advanced.csv`.

## Case C — Integration in kernel

::: code-group
<<< ../../snippets/pragmas/reduce/04-integration.castm{castm} [CASTM]
<<< ../../snippets/pragmas/reduce/04-integration.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/reduce/04-integration.csv`.

## Case D — Edge / boundary

::: code-group
<<< ../../snippets/pragmas/reduce/05-edge.castm{castm} [CASTM]
<<< ../../snippets/pragmas/reduce/05-edge.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/reduce/05-edge.csv`.

## Case E — Invalid usage

<<< ../../snippets/pragmas/reduce/03-invalid.castm{castm-fail} [CASTM fail]

Expected: explicit diagnostic with source span and actionable hint.

## Lowering notes

Builds axis-aware combine phases with stable row-major emission.

## Related patterns

- Practical examples: [/examples/kernel-compaction](/examples/kernel-compaction)

- `std::scan(...)` for prefix-style accumulation
- `std::allreduce(...)` for globalized reduction
