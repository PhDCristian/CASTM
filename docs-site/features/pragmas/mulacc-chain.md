# `std::mulacc_chain(...)`

## When to use

Use deterministic multiply-accumulate propagation across a selected target region.

## Target and assumptions

All executable snippets below are canonical and explicit:

- `target "uma-cgra-base";`
- default grid: `4x4` toroidal profile unless overridden at compile time
- deterministic lowering: same source + options => same CSV

## Syntax

```text
std::mulacc_chain(src=Rs, coeff=Rc, acc=Ra, out=Ro, target=row(i)|col(j)|all, lanes=4, width=16, mask=65535, dir=right|left|up|down);
```

## Parameters

| Parameter | Required | Description |
|---|---|---|
| `src` | yes | Input multiplicand register. |
| `coeff` | yes | Coefficient register. |
| `acc` | yes | Accumulator register. |
| `out` | yes | Output register. |
| `target` | yes | Target rows/cols/all. |
| `width` | yes | Fixed-point width. |
| `dir` | yes | Propagation direction. |
| `lanes/mask` | no | Optional lane count and explicit mask. |

## Case A — Minimal

::: code-group
<<< ../../snippets/pragmas/mulacc-chain/01-minimal.edsl{openedge} [OpenEdgeDSL]
<<< ../../snippets/pragmas/mulacc-chain/01-minimal.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/mulacc-chain/01-minimal.csv`.

## Case B — Advanced options

::: code-group
<<< ../../snippets/pragmas/mulacc-chain/02-advanced.edsl{openedge} [OpenEdgeDSL]
<<< ../../snippets/pragmas/mulacc-chain/02-advanced.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/mulacc-chain/02-advanced.csv`.

## Case C — Invalid usage

<<< ../../snippets/pragmas/mulacc-chain/03-invalid.edsl{openedge-fail} [OpenEdgeDSL fail]

Expected: explicit diagnostic with source span and actionable hint.

## Lowering notes

Lowers to staged multiply/add/carry updates aligned with selected target traversal.

## Related patterns

- `std::carry_chain(...)` for carry materialization
- `std::normalize(...)` for post-propagation normalization
