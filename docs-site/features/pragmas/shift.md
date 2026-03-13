# `std::shift(...)`

## When to use

Use directional shifting with explicit fill semantics.

## Target and assumptions

All executable snippets below are canonical and explicit:

- `target base;`
- default grid: `4x4` toroidal profile unless overridden at compile time
- deterministic lowering: same source + options => same CSV

## Syntax

```text
std::shift(reg=R0, direction=left|right, distance=1, fill=0);
```

## Parameters

| Parameter | Required | Description |
|---|---|---|
| `reg` | yes | Register to shift. |
| `direction` | yes | `left` or `right`. |
| `distance` | no | Positive integer distance (default `1`). |
| `fill` | no | Fill value inserted at exposed boundary. |

## Case A — Minimal

::: code-group
<<< ../../snippets/pragmas/shift/01-minimal.castm{castm} [CASTM]
<<< ../../snippets/pragmas/shift/01-minimal.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/shift/01-minimal.csv`.

## Case B — Advanced options

::: code-group
<<< ../../snippets/pragmas/shift/02-advanced.castm{castm} [CASTM]
<<< ../../snippets/pragmas/shift/02-advanced.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/shift/02-advanced.csv`.

## Case C — Integration in kernel

::: code-group
<<< ../../snippets/pragmas/shift/04-integration.castm{castm} [CASTM]
<<< ../../snippets/pragmas/shift/04-integration.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/shift/04-integration.csv`.

## Case D — Edge / boundary

::: code-group
<<< ../../snippets/pragmas/shift/05-edge.castm{castm} [CASTM]
<<< ../../snippets/pragmas/shift/05-edge.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/shift/05-edge.csv`.

## Case E — Invalid usage

<<< ../../snippets/pragmas/shift/03-invalid.castm{castm-fail} [CASTM fail]

Expected: explicit diagnostic with source span and actionable hint.

## Lowering notes

Builds deterministic directional transfers and boundary fill writes.

## Related patterns

- Practical examples: [/examples/kernel-compaction](/examples/kernel-compaction)

- `std::rotate(...)` for cyclic movement
- `std::scan(...)` for cumulative directional ops
