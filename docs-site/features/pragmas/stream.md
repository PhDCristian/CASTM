# `std::stream_load/store(...)`

## When to use

Use to connect row-local stream interfaces with register values.

## Target and assumptions

All executable snippets below are canonical and explicit:

- `target base;`
- default grid: `4x4` toroidal profile unless overridden at compile time
- deterministic lowering: same source + options => same CSV

## Syntax

```text
std::stream_load(dest=Rd, row=0, count=1);
std::stream_store(src=Rs, row=0, count=1);
```

## Parameters

| Parameter | Required | Description |
|---|---|---|
| `dest/src` | yes | Load destination or store source register. |
| `row` | no | Target stream row (default `0`). |
| `count` | no | Number of stream operations (default `1`). |

## Case A — Minimal

::: code-group
<<< ../../snippets/pragmas/stream/01-minimal.castm{castm} [CASTM]
<<< ../../snippets/pragmas/stream/01-minimal.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/stream/01-minimal.csv`.

## Case B — Advanced options

::: code-group
<<< ../../snippets/pragmas/stream/02-advanced.castm{castm} [CASTM]
<<< ../../snippets/pragmas/stream/02-advanced.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/stream/02-advanced.csv`.

## Case C — Integration in kernel

::: code-group
<<< ../../snippets/pragmas/stream/04-integration.castm{castm} [CASTM]
<<< ../../snippets/pragmas/stream/04-integration.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/stream/04-integration.csv`.

## Case D — Edge / boundary

::: code-group
<<< ../../snippets/pragmas/stream/05-edge.castm{castm} [CASTM]
<<< ../../snippets/pragmas/stream/05-edge.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/stream/05-edge.csv`.

## Case E — Invalid usage

<<< ../../snippets/pragmas/stream/03-invalid.castm{castm-fail} [CASTM fail]

Expected: explicit diagnostic with source span and actionable hint.

## Lowering notes

Lowers to LWD/SWD stream memory operations in deterministic order.

## Related patterns

- Practical examples: [/examples/kernel-compaction](/examples/kernel-compaction)

- `std::route(...)` for in-grid post-load distribution
- `std::shift(...)` for row-local movement
