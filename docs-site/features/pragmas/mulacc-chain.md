# `std::mulacc_chain(...)`

## When to use

Use deterministic multiply-accumulate propagation across a selected target region.

## Target and assumptions

All executable snippets below are canonical and explicit:

- `target base;`
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
<<< ../../snippets/pragmas/mulacc-chain/01-minimal.castm{castm} [CASTM]
<<< ../../snippets/pragmas/mulacc-chain/01-minimal.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/mulacc-chain/01-minimal.csv`.

## Case B — Advanced options

::: code-group
<<< ../../snippets/pragmas/mulacc-chain/02-advanced.castm{castm} [CASTM]
<<< ../../snippets/pragmas/mulacc-chain/02-advanced.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/mulacc-chain/02-advanced.csv`.

## Case C — Integration in kernel

::: code-group
<<< ../../snippets/pragmas/mulacc-chain/04-integration.castm{castm} [CASTM]
<<< ../../snippets/pragmas/mulacc-chain/04-integration.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/mulacc-chain/04-integration.csv`.

## Case D — Edge / boundary

::: code-group
<<< ../../snippets/pragmas/mulacc-chain/05-edge.castm{castm} [CASTM]
<<< ../../snippets/pragmas/mulacc-chain/05-edge.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/mulacc-chain/05-edge.csv`.

## Case E — Invalid usage

<<< ../../snippets/pragmas/mulacc-chain/03-invalid.castm{castm-fail} [CASTM fail]

Expected: explicit diagnostic with source span and actionable hint.

## Lowering notes

Lowers to staged multiply/add/carry updates aligned with selected target traversal.

## Related patterns

- Practical examples: [/examples/kernel-compaction](/examples/kernel-compaction)

- `std::carry_chain(...)` for carry materialization
- `std::normalize(...)` for post-propagation normalization
