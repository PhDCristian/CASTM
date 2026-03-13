# `std::gather(...)`

## When to use

Use to collect values from the mesh into a specific destination point and register.

## Target and assumptions

All executable snippets below are canonical and explicit:

- `target base;`
- default grid: `4x4` toroidal profile unless overridden at compile time
- deterministic lowering: same source + options => same CSV

## Syntax

```text
std::gather(src=Rs, dest=@r,c, destReg=Rd, op=add|...);
```

## Parameters

| Parameter | Required | Description |
|---|---|---|
| `src` | yes | Source register on producers. |
| `dest` | yes | Destination point coordinate. |
| `destReg` | yes | Destination register on sink. |
| `op` | yes | Combine operation at destination. |

## Case A — Minimal

::: code-group
<<< ../../snippets/pragmas/gather/01-minimal.castm{castm} [CASTM]
<<< ../../snippets/pragmas/gather/01-minimal.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/gather/01-minimal.csv`.

## Case B — Advanced options

::: code-group
<<< ../../snippets/pragmas/gather/02-advanced.castm{castm} [CASTM]
<<< ../../snippets/pragmas/gather/02-advanced.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/gather/02-advanced.csv`.

## Case C — Integration in kernel

::: code-group
<<< ../../snippets/pragmas/gather/04-integration.castm{castm} [CASTM]
<<< ../../snippets/pragmas/gather/04-integration.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/gather/04-integration.csv`.

## Case D — Edge / boundary

::: code-group
<<< ../../snippets/pragmas/gather/05-edge.castm{castm} [CASTM]
<<< ../../snippets/pragmas/gather/05-edge.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/gather/05-edge.csv`.

## Case E — Invalid usage

<<< ../../snippets/pragmas/gather/03-invalid.castm{castm-fail} [CASTM fail]

Expected: explicit diagnostic with source span and actionable hint.

## Lowering notes

Builds deterministic gather routes ending in operation at sink point.

## Related patterns

- Practical examples: [/examples/kernel-compaction](/examples/kernel-compaction)

- `std::collect(...)` for axis-constrained gathering
- `std::route(...)` for explicit source-destination pathing
