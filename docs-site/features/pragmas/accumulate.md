# `std::accumulate(...)`

## When to use

Use pattern-driven accumulation with configurable combine, steps, and optional scope.

## Target and assumptions

All executable snippets below are canonical and explicit:

- `target base;`
- default grid: `4x4` toroidal profile unless overridden at compile time
- deterministic lowering: same source + options => same CSV

## Syntax

```text
std::accumulate(pattern=row|col|anti_diagonal, products=Rs, accum=Ra, out=Rd, combine=add, steps=1, scope=all|row(i)|col(j));
```

## Parameters

| Parameter | Required | Description |
|---|---|---|
| `pattern` | yes | Accumulation topology. |
| `products` | yes | Input products register. |
| `accum` | yes | Accumulator register. |
| `out` | yes | Final output register. |
| `combine` | no | Combiner (`add` default). |
| `steps` | no | Propagation iterations. |
| `scope` | no | `all` (default) or scoped row/col. |

## Case A — Minimal

::: code-group
<<< ../../snippets/pragmas/accumulate/01-minimal.castm{castm} [CASTM]
<<< ../../snippets/pragmas/accumulate/01-minimal.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/accumulate/01-minimal.csv`.

## Case B — Advanced options

::: code-group
<<< ../../snippets/pragmas/accumulate/02-advanced.castm{castm} [CASTM]
<<< ../../snippets/pragmas/accumulate/02-advanced.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/accumulate/02-advanced.csv`.

## Case C — Integration in kernel

::: code-group
<<< ../../snippets/pragmas/accumulate/04-integration.castm{castm} [CASTM]
<<< ../../snippets/pragmas/accumulate/04-integration.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/accumulate/04-integration.csv`.

## Case D — Edge / boundary

::: code-group
<<< ../../snippets/pragmas/accumulate/05-edge.castm{castm} [CASTM]
<<< ../../snippets/pragmas/accumulate/05-edge.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/accumulate/05-edge.csv`.

## Case E — Invalid usage

<<< ../../snippets/pragmas/accumulate/03-invalid.castm{castm-fail} [CASTM fail]

Expected: explicit diagnostic with source span and actionable hint.

## Lowering notes

Emits seed, propagation, and finalize stages according to pattern and scope.

## Related patterns

- Practical examples: [/examples/kernel-compaction](/examples/kernel-compaction)

- `std::scan(...)` for directional prefix behavior
- `std::reduce(...)` for terminal axis collapse
