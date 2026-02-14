# `std::stencil(...)`

## When to use

Use neighborhood patterns for local diffusion or filtering-style kernels.

## Target and assumptions

All executable snippets below are canonical and explicit:

- `target "uma-cgra-base";`
- default grid: `4x4` toroidal profile unless overridden at compile time
- deterministic lowering: same source + options => same CSV

## Syntax

```text
std::stencil(cross|horizontal|vertical, op, srcReg, destReg);
```

## Parameters

| Parameter | Required | Description |
|---|---|---|
| `pattern` | yes | Neighborhood shape (`cross`, `horizontal`, `vertical`). |
| `op` | yes | Combine operation name. |
| `src` | yes | Source register. |
| `dest` | yes | Destination register. |

## Case A — Minimal

::: code-group
<<< ../../snippets/pragmas/stencil/01-minimal.edsl{openedge} [OpenEdgeDSL]
<<< ../../snippets/pragmas/stencil/01-minimal.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/stencil/01-minimal.csv`.

## Case B — Advanced options

::: code-group
<<< ../../snippets/pragmas/stencil/02-advanced.edsl{openedge} [OpenEdgeDSL]
<<< ../../snippets/pragmas/stencil/02-advanced.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/stencil/02-advanced.csv`.

## Case C — Invalid usage

<<< ../../snippets/pragmas/stencil/03-invalid.edsl{openedge-fail} [OpenEdgeDSL fail]

Expected: explicit diagnostic with source span and actionable hint.

## Lowering notes

Lowers to pattern-specific neighbor reads and deterministic combine writes.

## Related patterns

- `std::guard(...)` for conditional activation
- `std::triangle(...)` for geometric masking
