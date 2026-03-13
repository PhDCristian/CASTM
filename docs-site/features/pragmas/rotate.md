# `std::rotate(...)`

## When to use

Use lane rotation when values must circulate horizontally with wrap semantics.

## Target and assumptions

All executable snippets below are canonical and explicit:

- `target base;`
- default grid: `4x4` toroidal profile unless overridden at compile time
- deterministic lowering: same source + options => same CSV

## Syntax

```text
std::rotate(reg=R0, direction=left|right, distance=1);
```

## Parameters

| Parameter | Required | Description |
|---|---|---|
| `reg` | yes | Register to rotate. |
| `direction` | yes | `left` or `right`. |
| `distance` | no | Positive integer distance (default `1`). |

## Case A — Minimal

::: code-group
<<< ../../snippets/pragmas/rotate/01-minimal.castm{castm} [CASTM]
<<< ../../snippets/pragmas/rotate/01-minimal.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/rotate/01-minimal.csv`.

## Case B — Advanced options

::: code-group
<<< ../../snippets/pragmas/rotate/02-advanced.castm{castm} [CASTM]
<<< ../../snippets/pragmas/rotate/02-advanced.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/rotate/02-advanced.csv`.

## Case C — Integration in kernel

::: code-group
<<< ../../snippets/pragmas/rotate/04-integration.castm{castm} [CASTM]
<<< ../../snippets/pragmas/rotate/04-integration.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/rotate/04-integration.csv`.

## Case D — Edge / boundary

::: code-group
<<< ../../snippets/pragmas/rotate/05-edge.castm{castm} [CASTM]
<<< ../../snippets/pragmas/rotate/05-edge.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/rotate/05-edge.csv`.

## Case E — Invalid usage

<<< ../../snippets/pragmas/rotate/03-invalid.castm{castm-fail} [CASTM fail]

Expected: explicit diagnostic with source span and actionable hint.

## Lowering notes

Emits deterministic movement cycles preserving lane order by distance.

## Related patterns

- Practical examples: [/examples/kernel-compaction](/examples/kernel-compaction)

- `std::shift(...)` for directional move with fill
- `std::route(...)` for targeted transfer
