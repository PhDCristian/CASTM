# `std::normalize(...)`

## When to use

Use to apply carry register across fixed-width lanes and clamp with mask.

## Target and assumptions

All executable snippets below are canonical and explicit:

- `target base;`
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
<<< ../../snippets/pragmas/normalize/01-minimal.castm{castm} [CASTM]
<<< ../../snippets/pragmas/normalize/01-minimal.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/normalize/01-minimal.csv`.

## Case B — Advanced options

::: code-group
<<< ../../snippets/pragmas/normalize/02-advanced.castm{castm} [CASTM]
<<< ../../snippets/pragmas/normalize/02-advanced.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/normalize/02-advanced.csv`.

## Case C — Integration in kernel

::: code-group
<<< ../../snippets/pragmas/normalize/04-integration.castm{castm} [CASTM]
<<< ../../snippets/pragmas/normalize/04-integration.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/normalize/04-integration.csv`.

## Case D — Edge / boundary

::: code-group
<<< ../../snippets/pragmas/normalize/05-edge.castm{castm} [CASTM]
<<< ../../snippets/pragmas/normalize/05-edge.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/normalize/05-edge.csv`.

## Case E — Invalid usage

<<< ../../snippets/pragmas/normalize/03-invalid.castm{castm-fail} [CASTM fail]

Expected: explicit diagnostic with source span and actionable hint.

## Lowering notes

Emits shift/mask/route/add stages with axis-direction consistency checks.

## Related patterns

- Practical examples: [/examples/kernel-compaction](/examples/kernel-compaction)

- `std::carry_chain(...)` for carry generation
- `std::extract_bytes(...)` for post-normalization byte slicing
