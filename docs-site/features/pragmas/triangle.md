# `std::triangle(...)`

## When to use

Use upper/lower triangular spatial masks with explicit operation semantics.

## Target and assumptions

All executable snippets below are canonical and explicit:

- `target base;`
- default grid: `4x4` toroidal profile unless overridden at compile time
- deterministic lowering: same source + options => same CSV

## Syntax

```text
std::triangle(shape=upper|lower, inclusive=true|false, op=OPCODE, dest=Rd, srcA=Ra, srcB=Rb);
```

## Parameters

| Parameter | Required | Description |
|---|---|---|
| `shape` | yes | Triangle orientation. |
| `inclusive` | no | Include diagonal (`true` default). |
| `op` | yes | Opcode for active cells. |
| `dest` | yes | Destination register. |
| `srcA/srcB` | yes | Operands for operation. |

## Case A — Minimal

::: code-group
<<< ../../snippets/pragmas/triangle/01-minimal.castm{castm} [CASTM]
<<< ../../snippets/pragmas/triangle/01-minimal.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/triangle/01-minimal.csv`.

## Case B — Advanced options

::: code-group
<<< ../../snippets/pragmas/triangle/02-advanced.castm{castm} [CASTM]
<<< ../../snippets/pragmas/triangle/02-advanced.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/triangle/02-advanced.csv`.

## Case C — Integration in kernel

::: code-group
<<< ../../snippets/pragmas/triangle/04-integration.castm{castm} [CASTM]
<<< ../../snippets/pragmas/triangle/04-integration.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/triangle/04-integration.csv`.

## Case D — Edge / boundary

::: code-group
<<< ../../snippets/pragmas/triangle/05-edge.castm{castm} [CASTM]
<<< ../../snippets/pragmas/triangle/05-edge.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/triangle/05-edge.csv`.

## Case E — Invalid usage

<<< ../../snippets/pragmas/triangle/03-invalid.castm{castm-fail} [CASTM fail]

Expected: explicit diagnostic with source span and actionable hint.

## Lowering notes

Computes triangular membership at compile-time and emits deterministic row-major placements.

## Related patterns

- Practical examples: [/examples/kernel-compaction](/examples/kernel-compaction)

- `std::guard(...)` for arbitrary predicates
- `std::collect(...)` for post-mask aggregation
