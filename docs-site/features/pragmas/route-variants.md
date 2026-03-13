# `std::route(...)` Variants

## When to use

Use this page to compare route forms beyond the baseline `payload+accum` form and inspect custom destination operations.

## Target and assumptions

All executable snippets are canonical and explicit:

- `target base;`
- default grid: `4x4` toroidal profile unless overridden at compile time
- deterministic lowering: same source + options => same CSV

## Syntax

```text
std::route(@r1,c1 -> @r2,c2, payload=Rx, accum=Ry);
std::route(@r1,c1 -> @r2,c2, payload=Rx, dest=Rd, op=OP(Rd, Ra, INCOMING));
```

## Parameters

| Parameter | Required | Description |
|---|---|---|
| `payload` | yes | Register injected into route path. |
| `accum` | yes (simple form) | Destination accumulation register. |
| `dest` | yes (custom form) | Destination register used by custom op. |
| `op` | yes (custom form) | Operation expression at sink (uses `INCOMING`). |

## Case A — Minimal

::: code-group
<<< ../../snippets/pragmas/route-variants/02-long-path.castm{castm} [CASTM]
<<< ../../snippets/pragmas/route-variants/02-long-path.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/route-variants/02-long-path.csv`.

## Case B — Advanced options

::: code-group
<<< ../../snippets/pragmas/route-variants/01-custom-op.castm{castm} [CASTM]
<<< ../../snippets/pragmas/route-variants/01-custom-op.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/route-variants/01-custom-op.csv`.

## Case C — Integration in kernel

::: code-group
<<< ../../snippets/pragmas/route-variants/03-compare.castm{castm} [CASTM]
<<< ../../snippets/pragmas/route-variants/03-compare.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/route-variants/03-compare.csv`.

## Case D — Edge / boundary

::: code-group
<<< ../../snippets/pragmas/route-variants/05-edge.castm{castm} [CASTM]
<<< ../../snippets/pragmas/route-variants/05-edge.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/route-variants/05-edge.csv`.

## Case E — Invalid usage

<<< ../../snippets/pragmas/route-variants/06-invalid.castm{castm-fail} [CASTM fail]

Expected: explicit diagnostic with source span and actionable hint.

## Lowering notes

- `accum` form is ideal when the destination combines using built-in accumulation.
- `dest+op` form gives explicit sink operation control and can model custom combine logic.

## Related patterns

- Practical examples: [/examples/kernel-compaction](/examples/kernel-compaction)

- `std::route(...)` core page: [/features/pragmas/route](/features/pragmas/route)
- `std::broadcast(...)` when fan-out is needed instead of point-to-point transfer
