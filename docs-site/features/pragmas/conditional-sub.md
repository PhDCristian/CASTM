# `std::conditional_sub(...)`

## When to use

Use branchless conditional subtraction in scoped target regions.

## Target and assumptions

All executable snippets below are canonical and explicit:

- `target base;`
- default grid: `4x4` toroidal profile unless overridden at compile time
- deterministic lowering: same source + options => same CSV

## Syntax

```text
std::conditional_sub(value=Rv, sub=Rs, dest=Rd, target=all|row(i)|col(j)|point(r,c));
```

## Parameters

| Parameter | Required | Description |
|---|---|---|
| `value` | yes | Input value register. |
| `sub` | yes | Subtractor register. |
| `dest` | yes | Destination register. |
| `target` | no | Spatial scope (`all` default). |

## Case A — Minimal

::: code-group
<<< ../../snippets/pragmas/conditional-sub/01-minimal.castm{castm} [CASTM]
<<< ../../snippets/pragmas/conditional-sub/01-minimal.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/conditional-sub/01-minimal.csv`.

## Case B — Advanced options

::: code-group
<<< ../../snippets/pragmas/conditional-sub/02-advanced.castm{castm} [CASTM]
<<< ../../snippets/pragmas/conditional-sub/02-advanced.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/conditional-sub/02-advanced.csv`.

## Case C — Integration in kernel

::: code-group
<<< ../../snippets/pragmas/conditional-sub/04-integration.castm{castm} [CASTM]
<<< ../../snippets/pragmas/conditional-sub/04-integration.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/conditional-sub/04-integration.csv`.

## Case D — Edge / boundary

::: code-group
<<< ../../snippets/pragmas/conditional-sub/05-edge.castm{castm} [CASTM]
<<< ../../snippets/pragmas/conditional-sub/05-edge.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/conditional-sub/05-edge.csv`.

## Case E — Invalid usage

<<< ../../snippets/pragmas/conditional-sub/03-invalid.castm{castm-fail} [CASTM fail]

Expected: explicit diagnostic with source span and actionable hint.

## Lowering notes

Creates deterministic compare/sub/select stages without control-flow divergence.

## Related patterns

- Practical examples: [/examples/kernel-compaction](/examples/kernel-compaction)

- `std::guard(...)` for predicate-based activation
- `std::reduce(...)` for preceding aggregate build
