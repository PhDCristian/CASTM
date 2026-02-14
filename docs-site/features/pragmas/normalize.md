# `std::normalize(...)`

## When to use

Use to apply carry register across fixed-width lanes and clamp with mask.

## Target and assumptions

All executable snippets below are canonical and explicit:

- `target "uma-cgra-base";`
- default grid: `4x4` toroidal profile unless overridden at compile time
- deterministic lowering: same source + options => same CSV

## Syntax

```text
std::normalize(reg=Rr, carry=Rc, width=W, lane=i, axis=row|col, dir=right|left|up|down, mask=...);
```

## Parameters

| Parameter | Required | Description |
|---|---|---|
| `reg` | yes | Primary value register. |
| `carry` | yes | Carry source register. |
| `width` | yes | Lane width in bits. |
| `lane` | yes | Lane index along axis. |
| `axis` | no | `row` default or `col`. |
| `dir` | no | Directional propagation for selected axis. |
| `mask` | no | Explicit mask override. |

## Case A — Minimal

::: code-group
<<< ../../snippets/pragmas/normalize/01-minimal.edsl{openedge} [OpenEdgeDSL]
<<< ../../snippets/pragmas/normalize/01-minimal.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/normalize/01-minimal.csv`.

## Case B — Advanced options

::: code-group
<<< ../../snippets/pragmas/normalize/02-advanced.edsl{openedge} [OpenEdgeDSL]
<<< ../../snippets/pragmas/normalize/02-advanced.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/normalize/02-advanced.csv`.

## Case C — Invalid usage

<<< ../../snippets/pragmas/normalize/03-invalid.edsl{openedge-fail} [OpenEdgeDSL fail]

Expected: explicit diagnostic with source span and actionable hint.

## Lowering notes

Emits shift/mask/route/add stages with axis-direction consistency checks.

## Related patterns

- `std::carry_chain(...)` for carry generation
- `std::extract_bytes(...)` for post-normalization byte slicing
