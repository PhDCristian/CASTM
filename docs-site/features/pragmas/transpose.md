# `std::transpose(...)`

## When to use

Use for grid-wise transposition of lane-carried values.

## Target and assumptions

All executable snippets below are canonical and explicit:

- `target base;`
- default grid: `4x4` toroidal profile unless overridden at compile time
- deterministic lowering: same source + options => same CSV

## Syntax

```text
std::transpose(reg=R0);
```

## Parameters

| Parameter | Required | Description |
|---|---|---|
| `reg` | yes | Register to transpose across the grid. |

## Case A — Minimal

::: code-group
<<< ../../snippets/pragmas/transpose/01-minimal.castm{castm} [CASTM]
<<< ../../snippets/pragmas/transpose/01-minimal.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/transpose/01-minimal.csv`.

## Case B — Advanced options

::: code-group
<<< ../../snippets/pragmas/transpose/02-advanced.castm{castm} [CASTM]
<<< ../../snippets/pragmas/transpose/02-advanced.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/transpose/02-advanced.csv`.

## Case C — Integration in kernel

::: code-group
<<< ../../snippets/pragmas/transpose/04-integration.castm{castm} [CASTM]
<<< ../../snippets/pragmas/transpose/04-integration.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/transpose/04-integration.csv`.

## Case D — Edge / boundary

::: code-group
<<< ../../snippets/pragmas/transpose/05-edge.castm{castm} [CASTM]
<<< ../../snippets/pragmas/transpose/05-edge.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/transpose/05-edge.csv`.

## Case E — Invalid usage

<<< ../../snippets/pragmas/transpose/03-invalid.castm{castm-fail} [CASTM fail]

Expected: explicit diagnostic with source span and actionable hint.

## Lowering notes

Generates stable transpose choreography with deterministic cycle ordering.

## Related patterns

- Practical examples: [/examples/kernel-compaction](/examples/kernel-compaction)

- `std::gather(...)` for destination-centric collection
- `std::route(...)` for explicit pairwise movement
