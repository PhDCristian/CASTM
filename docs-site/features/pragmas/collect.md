# `std::collect(...)`

## When to use

Use axis-scoped collection from one slice into another with a chosen combiner.

## Target and assumptions

All executable snippets below are canonical and explicit:

- `target "uma-cgra-base";`
- default grid: `4x4` toroidal profile unless overridden at compile time
- deterministic lowering: same source + options => same CSV

## Syntax

```text
std::collect(from=row(i)|col(j), to=row(k)|col(k), via=Rv, local=Rl, into=Rd, combine=copy|add|...);
```

## Parameters

| Parameter | Required | Description |
|---|---|---|
| `from` | yes | Source axis reference. |
| `to` | no | Destination axis reference (default index 0 same axis). |
| `via` | yes | Transit register. |
| `local` | yes | Local source register. |
| `into` | yes | Destination register. |
| `combine` | no | Combine strategy (`add` default). |

## Case A — Minimal

::: code-group
<<< ../../snippets/pragmas/collect/01-minimal.edsl{openedge} [OpenEdgeDSL]
<<< ../../snippets/pragmas/collect/01-minimal.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/collect/01-minimal.csv`.

## Case B — Advanced options

::: code-group
<<< ../../snippets/pragmas/collect/02-advanced.edsl{openedge} [OpenEdgeDSL]
<<< ../../snippets/pragmas/collect/02-advanced.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/collect/02-advanced.csv`.

## Case C — Invalid usage

<<< ../../snippets/pragmas/collect/03-invalid.edsl{openedge-fail} [OpenEdgeDSL fail]

Expected: explicit diagnostic with source span and actionable hint.

## Lowering notes

Builds axis-constrained collection passes and sink combine writes.

## Related patterns

- `std::gather(...)` for point sink
- `std::broadcast(...)` for reverse fan-out direction
