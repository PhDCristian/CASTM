# `std::latency_hide(...)`

## When to use

Use conservative slot compaction hints while preserving deterministic semantics.

## Target and assumptions

All executable snippets below are canonical and explicit:

- `target base;`
- default grid: `4x4` toroidal profile unless overridden in source `build { ... }`
- deterministic lowering: same source => same CSV

## Syntax

```text
std::latency_hide(window=1..256, mode=conservative);
```

## Parameters

| Parameter | Required | Description |
|---|---|---|
| `window` | yes | Compaction lookahead window. |
| `mode` | yes | Currently `conservative` only. |

## Case A — Minimal

::: code-group
<<< ../../snippets/pragmas/auto-cycle/01-minimal.castm{castm} [CASTM]
<<< ../../snippets/pragmas/auto-cycle/01-minimal.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/auto-cycle/01-minimal.csv`.

## Case B — Advanced options

::: code-group
<<< ../../snippets/pragmas/auto-cycle/02-advanced.castm{castm} [CASTM]
<<< ../../snippets/pragmas/auto-cycle/02-advanced.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/auto-cycle/02-advanced.csv`.

## Case C — Integration in kernel

::: code-group
<<< ../../snippets/pragmas/auto-cycle/04-integration.castm{castm} [CASTM]
<<< ../../snippets/pragmas/auto-cycle/04-integration.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/auto-cycle/04-integration.csv`.

## Case D — Edge / boundary

::: code-group
<<< ../../snippets/pragmas/auto-cycle/05-edge.castm{castm} [CASTM]
<<< ../../snippets/pragmas/auto-cycle/05-edge.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/auto-cycle/05-edge.csv`.

## Case E — Invalid usage

<<< ../../snippets/pragmas/auto-cycle/03-invalid.castm{castm-fail} [CASTM fail]

Expected: explicit diagnostic with source span and actionable hint.

## Lowering notes

Acts as optimizer hint; does not emit standalone ISA operations by itself.

## Related patterns

- Practical examples: [/examples/kernel-compaction](/examples/kernel-compaction)

- `build { scheduler ...; scheduler_window ...; memory_reorder ... }`
- `std::stash(...)` for explicit save/restore boundaries
