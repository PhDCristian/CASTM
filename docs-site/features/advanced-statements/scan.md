# `std::scan(...)`

## When to use

Use prefix-style propagation across lanes with inclusive or exclusive modes.

## Target and assumptions

All executable snippets below are canonical and explicit:

- `target base;`
- default grid: `4x4` toroidal profile unless overridden at compile time
- deterministic lowering: same source + options => same CSV

## Syntax

```text
std::scan(op=add|..., src=Rs, dest=Rd, dir=left|right|up|down, mode=inclusive|exclusive);
```

## Parameters

| Parameter | Required | Description |
|---|---|---|
| `op` | yes | Scan combine operation. |
| `src` | yes | Source register. |
| `dest` | yes | Destination register. |
| `dir` | yes | Propagation direction. |
| `mode` | no | `inclusive` (default) or `exclusive`. |

## Case A — Minimal

::: code-group
<<< ../../snippets/advanced-statements/scan/01-minimal.castm{castm} [CASTM]
<<< ../../snippets/advanced-statements/scan/01-minimal.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/advanced-statements/scan/01-minimal.csv`.

## Case B — Advanced options

::: code-group
<<< ../../snippets/advanced-statements/scan/02-advanced.castm{castm} [CASTM]
<<< ../../snippets/advanced-statements/scan/02-advanced.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/advanced-statements/scan/02-advanced.csv`.

## Case C — Integration in kernel

::: code-group
<<< ../../snippets/advanced-statements/scan/04-integration.castm{castm} [CASTM]
<<< ../../snippets/advanced-statements/scan/04-integration.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/advanced-statements/scan/04-integration.csv`.

## Case D — Edge / boundary

::: code-group
<<< ../../snippets/advanced-statements/scan/05-edge.castm{castm} [CASTM]
<<< ../../snippets/advanced-statements/scan/05-edge.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/advanced-statements/scan/05-edge.csv`.

## Case E — Invalid usage

<<< ../../snippets/advanced-statements/scan/03-invalid.castm{castm-fail} [CASTM fail]

Expected: explicit diagnostic with source span and actionable hint.

## Lowering notes

Expands to directional lane hops plus per-lane combine stages.

## Related patterns

- Practical examples: [/examples/kernel-compaction](/examples/kernel-compaction)

- `std::reduce(...)` for final collapse
- `std::accumulate(...)` for pattern-driven accumulation
