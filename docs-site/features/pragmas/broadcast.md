# `std::broadcast(...)`

## When to use

Use when one PE must distribute a value to a row, column, or the full grid.

## Target and assumptions

All executable snippets below are canonical and explicit:

- `target base;`
- default grid: `4x4` toroidal profile unless overridden at compile time
- deterministic lowering: same source + options => same CSV

## Syntax

```text
std::broadcast(value=R0, from=@r,c, to=row|column|all);
```

## Parameters

| Parameter | Required | Description |
|---|---|---|
| `value` | yes | Register value to broadcast. |
| `from` | yes | Source PE coordinate. |
| `to` | yes | Broadcast scope: row, column, or all. |

## Case A — Minimal

::: code-group
<<< ../../snippets/pragmas/broadcast/01-minimal.castm{castm} [CASTM]
<<< ../../snippets/pragmas/broadcast/01-minimal.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/broadcast/01-minimal.csv`.

## Case B — Advanced options

::: code-group
<<< ../../snippets/pragmas/broadcast/02-advanced.castm{castm} [CASTM]
<<< ../../snippets/pragmas/broadcast/02-advanced.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/broadcast/02-advanced.csv`.

## Case C — Integration in kernel

::: code-group
<<< ../../snippets/pragmas/broadcast/04-integration.castm{castm} [CASTM]
<<< ../../snippets/pragmas/broadcast/04-integration.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/broadcast/04-integration.csv`.

## Case D — Edge / boundary

::: code-group
<<< ../../snippets/pragmas/broadcast/05-edge.castm{castm} [CASTM]
<<< ../../snippets/pragmas/broadcast/05-edge.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/broadcast/05-edge.csv`.

## Case E — Invalid usage

<<< ../../snippets/pragmas/broadcast/03-invalid.castm{castm-fail} [CASTM fail]

Expected: explicit diagnostic with source span and actionable hint.

## Lowering notes

Generates deterministic propagation cycles from the source point to the selected scope.

## Related patterns

- Practical examples: [/examples/kernel-compaction](/examples/kernel-compaction)

- `std::route(...)` for point-to-point movement
- `std::allreduce(...)` for aggregate then fan-out
