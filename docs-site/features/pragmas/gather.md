# `std::gather(...)`

## When to use

Use to collect values from the mesh into a specific destination point and register.

## Target and assumptions

All executable snippets below are canonical and explicit:

- `target "uma-cgra-base";`
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
<<< ../../snippets/pragmas/gather/01-minimal.edsl{openedge} [OpenEdgeDSL]
<<< ../../snippets/pragmas/gather/01-minimal.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/gather/01-minimal.csv`.

## Case B — Advanced options

::: code-group
<<< ../../snippets/pragmas/gather/02-advanced.edsl{openedge} [OpenEdgeDSL]
<<< ../../snippets/pragmas/gather/02-advanced.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/gather/02-advanced.csv`.

## Case C — Invalid usage

<<< ../../snippets/pragmas/gather/03-invalid.edsl{openedge-fail} [OpenEdgeDSL fail]

Expected: explicit diagnostic with source span and actionable hint.

## Lowering notes

Builds deterministic gather routes ending in operation at sink point.

## Related patterns

- `std::collect(...)` for axis-constrained gathering
- `std::route(...)` for explicit source-destination pathing
