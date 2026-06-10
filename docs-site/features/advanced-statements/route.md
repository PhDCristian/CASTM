# `std::route(...)`

## When to use

Use deterministic point-to-point transfers when source and destination PEs are known and routing order matters.

## Target and assumptions

All executable snippets below are canonical and explicit:

- `target base;`
- default grid: `4x4` toroidal profile unless overridden at compile time
- deterministic lowering: same source + options => same CSV

## Syntax

```text
std::route(@r1,c1 -> @r2,c2, payload=Rx, accum=Ry);
```

## Parameters

| Parameter | Required | Description |
|---|---|---|
| `payload` | yes | Register injected into the route path. |
| `accum` | yes | Destination accumulation register at target PE. |

## Case A — Minimal

::: code-group
<<< ../../snippets/advanced-statements/route/01-minimal.castm{castm} [CASTM]
<<< ../../snippets/advanced-statements/route/01-minimal.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/advanced-statements/route/01-minimal.csv`.

## Case B — Advanced options

::: code-group
<<< ../../snippets/advanced-statements/route/02-advanced.castm{castm} [CASTM]
<<< ../../snippets/advanced-statements/route/02-advanced.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/advanced-statements/route/02-advanced.csv`.

## Case C — Integration in kernel

::: code-group
<<< ../../snippets/advanced-statements/route/04-integration.castm{castm} [CASTM]
<<< ../../snippets/advanced-statements/route/04-integration.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/advanced-statements/route/04-integration.csv`.

## Case D — Edge / boundary

::: code-group
<<< ../../snippets/advanced-statements/route/05-edge.castm{castm} [CASTM]
<<< ../../snippets/advanced-statements/route/05-edge.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/advanced-statements/route/05-edge.csv`.

## Case E — Invalid usage

<<< ../../snippets/advanced-statements/route/03-invalid.castm{castm-fail} [CASTM fail]

Expected: explicit diagnostic with source span and actionable hint.

## Lowering notes

Lowers to deterministic hop bundles that preserve lexical statement order in the kernel timeline.

## Related patterns

- Practical examples: [/examples/kernel-compaction](/examples/kernel-compaction)

- `std::broadcast(...)` for fan-out from one source
- `std::collect(...)` for axis collection
- `std::route(...) variants` for custom sink operations: [/features/advanced-statements/route-variants](/features/advanced-statements/route-variants)
