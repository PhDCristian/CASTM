# `std::extract_bytes(...)`

## When to use

Use to align lane values to byte slices by row or column axis.

## Target and assumptions

All executable snippets below are canonical and explicit:

- `target "uma-cgra-base";`
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
<<< ../../snippets/pragmas/extract-bytes/01-minimal.edsl{openedge} [OpenEdgeDSL]
<<< ../../snippets/pragmas/extract-bytes/01-minimal.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/extract-bytes/01-minimal.csv`.

## Case B — Advanced options

::: code-group
<<< ../../snippets/pragmas/extract-bytes/02-advanced.edsl{openedge} [OpenEdgeDSL]
<<< ../../snippets/pragmas/extract-bytes/02-advanced.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/extract-bytes/02-advanced.csv`.

## Case C — Invalid usage

<<< ../../snippets/pragmas/extract-bytes/03-invalid.edsl{openedge-fail} [OpenEdgeDSL fail]

Expected: explicit diagnostic with source span and actionable hint.

## Lowering notes

Lowers to shift + mask pattern mapped deterministically across lanes.

## Related patterns

- `std::normalize(...)` for width-aware carry behavior
- `std::mulacc_chain(...)` for subsequent arithmetic chains
