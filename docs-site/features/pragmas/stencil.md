# `std::stencil(...)`

## When to use

Use neighborhood patterns for local diffusion or filtering-style kernels.

## Target and assumptions

All executable snippets below are canonical and explicit:

- `target base;`
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
<<< ../../snippets/pragmas/stencil/01-minimal.castm{castm} [CASTM]
<<< ../../snippets/pragmas/stencil/01-minimal.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/stencil/01-minimal.csv`.

## Case B — Advanced options

::: code-group
<<< ../../snippets/pragmas/stencil/02-advanced.castm{castm} [CASTM]
<<< ../../snippets/pragmas/stencil/02-advanced.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/stencil/02-advanced.csv`.

## Case C — Integration in kernel

::: code-group
<<< ../../snippets/pragmas/stencil/04-integration.castm{castm} [CASTM]
<<< ../../snippets/pragmas/stencil/04-integration.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/stencil/04-integration.csv`.

## Case D — Edge / boundary

::: code-group
<<< ../../snippets/pragmas/stencil/05-edge.castm{castm} [CASTM]
<<< ../../snippets/pragmas/stencil/05-edge.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/stencil/05-edge.csv`.

## Case E — Invalid usage

<<< ../../snippets/pragmas/stencil/03-invalid.castm{castm-fail} [CASTM fail]

Expected: explicit diagnostic with source span and actionable hint.

## Lowering notes

Lowers to pattern-specific neighbor reads and deterministic combine writes.

## Related patterns

- Practical examples: [/examples/kernel-compaction](/examples/kernel-compaction)

- `std::guard(...)` for conditional activation
- `std::triangle(...)` for geometric masking
