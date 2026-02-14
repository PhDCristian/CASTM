# `std::stream_load/store(...)`

## When to use

Use to connect row-local stream interfaces with register values.

## Target and assumptions

All executable snippets below are canonical and explicit:

- `target "uma-cgra-base";`
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
<<< ../../snippets/pragmas/stream/01-minimal.edsl{openedge} [OpenEdgeDSL]
<<< ../../snippets/pragmas/stream/01-minimal.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/stream/01-minimal.csv`.

## Case B — Advanced options

::: code-group
<<< ../../snippets/pragmas/stream/02-advanced.edsl{openedge} [OpenEdgeDSL]
<<< ../../snippets/pragmas/stream/02-advanced.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/stream/02-advanced.csv`.

## Case C — Invalid usage

<<< ../../snippets/pragmas/stream/03-invalid.edsl{openedge-fail} [OpenEdgeDSL fail]

Expected: explicit diagnostic with source span and actionable hint.

## Lowering notes

Lowers to LWD/SWD stream memory operations in deterministic order.

## Related patterns

- `std::route(...)` for in-grid post-load distribution
- `std::shift(...)` for row-local movement
