# `std::extract_bytes(...)`

## When to use

Use to align lane values to byte slices by row or column axis.

## Target and assumptions

All executable snippets below are canonical and explicit:

- `target base;`
- default grid: `4x4` toroidal profile unless overridden at compile time
- deterministic lowering: same source + options => same CSV

## Syntax

```text
std::extract_bytes(src=Rs, dest=Rd, axis=row|col, byteWidth=8, mask=255);
```

## Parameters

| Parameter | Required | Description |
|---|---|---|
| `src` | yes | Source register. |
| `dest` | yes | Destination register. |
| `axis` | no | `col` default or `row`. |
| `byteWidth` | no | Width per extracted byte chunk. |
| `mask` | no | Mask applied after shift. |

## Case A — Minimal

::: code-group
<<< ../../snippets/pragmas/extract-bytes/01-minimal.castm{castm} [CASTM]
<<< ../../snippets/pragmas/extract-bytes/01-minimal.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/extract-bytes/01-minimal.csv`.

## Case B — Advanced options

::: code-group
<<< ../../snippets/pragmas/extract-bytes/02-advanced.castm{castm} [CASTM]
<<< ../../snippets/pragmas/extract-bytes/02-advanced.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/extract-bytes/02-advanced.csv`.

## Case C — Integration in kernel

::: code-group
<<< ../../snippets/pragmas/extract-bytes/04-integration.castm{castm} [CASTM]
<<< ../../snippets/pragmas/extract-bytes/04-integration.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/extract-bytes/04-integration.csv`.

## Case D — Edge / boundary

::: code-group
<<< ../../snippets/pragmas/extract-bytes/05-edge.castm{castm} [CASTM]
<<< ../../snippets/pragmas/extract-bytes/05-edge.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/extract-bytes/05-edge.csv`.

## Case E — Invalid usage

<<< ../../snippets/pragmas/extract-bytes/03-invalid.castm{castm-fail} [CASTM fail]

Expected: explicit diagnostic with source span and actionable hint.

## Lowering notes

Lowers to shift + mask pattern mapped deterministically across lanes.

## Related patterns

- Practical examples: [/examples/kernel-compaction](/examples/kernel-compaction)

- `std::normalize(...)` for width-aware carry behavior
- `std::mulacc_chain(...)` for subsequent arithmetic chains
