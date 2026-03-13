# `std::carry_chain(...)`

## When to use

Use multi-limb carry propagation with explicit row/start/direction control.

## Target and assumptions

All executable snippets below are canonical and explicit:

- `target base;`
- default grid: `4x4` toroidal profile unless overridden at compile time
- deterministic lowering: same source + options => same CSV

## Syntax

```text
std::carry_chain(src=Rs, carry=Rc, store=Symbol, limbs=N, width=W, row=i, start=0, dir=right|left, mask=...);
```

## Parameters

| Parameter | Required | Description |
|---|---|---|
| `src` | yes | Source register. |
| `carry` | yes | Carry register. |
| `store` | yes | Destination symbol for limb stores. |
| `limbs` | yes | Number of limbs to process. |
| `width` | yes | Limb width. |
| `row` | yes | Target row index. |
| `start/dir/mask` | no | Optional starting column, direction, and mask. |

## Case A — Minimal

::: code-group
<<< ../../snippets/pragmas/carry-chain/01-minimal.castm{castm} [CASTM]
<<< ../../snippets/pragmas/carry-chain/01-minimal.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/carry-chain/01-minimal.csv`.

## Case B — Advanced options

::: code-group
<<< ../../snippets/pragmas/carry-chain/02-advanced.castm{castm} [CASTM]
<<< ../../snippets/pragmas/carry-chain/02-advanced.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/carry-chain/02-advanced.csv`.

## Case C — Integration in kernel

::: code-group
<<< ../../snippets/pragmas/carry-chain/04-integration.castm{castm} [CASTM]
<<< ../../snippets/pragmas/carry-chain/04-integration.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/carry-chain/04-integration.csv`.

## Case D — Edge / boundary

::: code-group
<<< ../../snippets/pragmas/carry-chain/05-edge.castm{castm} [CASTM]
<<< ../../snippets/pragmas/carry-chain/05-edge.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/carry-chain/05-edge.csv`.

## Case E — Invalid usage

<<< ../../snippets/pragmas/carry-chain/03-invalid.castm{castm-fail} [CASTM fail]

Expected: explicit diagnostic with source span and actionable hint.

## Lowering notes

Emits add/mask/shift/store chain with deterministic lane progression.

## Related patterns

- Practical examples: [/examples/kernel-compaction](/examples/kernel-compaction)

- `std::normalize(...)` for lane carry application
- `std::conditional_sub(...)` for final modular correction
