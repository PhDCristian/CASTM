# `std::guard(...)`

## When to use

Use compile-time spatial predicates to emit only valid PE placements.

## Target and assumptions

All executable snippets below are canonical and explicit:

- `target "uma-cgra-base";`
- default grid: `4x4` toroidal profile unless overridden at compile time
- deterministic lowering: same source + options => same CSV

## Syntax

```text
std::guard(cond=<expr>, op=OPCODE, dest=Rd, srcA=Ra, srcB=Rb);
```

## Parameters

| Parameter | Required | Description |
|---|---|---|
| `cond` | yes | Predicate over `row`, `col`, `idx`, `rows`, `cols`. |
| `op` | yes | Opcode for emitted instruction. |
| `dest` | yes | Destination register. |
| `srcA/srcB` | yes | Operand registers or immediates. |

## Case A — Minimal

::: code-group
<<< ../../snippets/pragmas/guard/01-minimal.edsl{openedge} [OpenEdgeDSL]
<<< ../../snippets/pragmas/guard/01-minimal.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/guard/01-minimal.csv`.

## Case B — Advanced options

::: code-group
<<< ../../snippets/pragmas/guard/02-advanced.edsl{openedge} [OpenEdgeDSL]
<<< ../../snippets/pragmas/guard/02-advanced.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/guard/02-advanced.csv`.

## Case C — Invalid usage

<<< ../../snippets/pragmas/guard/03-invalid.edsl{openedge-fail} [OpenEdgeDSL fail]

Expected: explicit diagnostic with source span and actionable hint.

## Lowering notes

Predicate is resolved per PE at compile time, then matching placements are emitted in row-major order.

## Related patterns

- `std::triangle(...)` for geometric masks
- `std::stencil(...)` for neighborhood activation
