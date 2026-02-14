# `std::latency_hide(...)`

## When to use

Use conservative slot compaction hints while preserving deterministic semantics.

## Target and assumptions

All executable snippets below are canonical and explicit:

- `target "uma-cgra-base";`
- default grid: `4x4` toroidal profile unless overridden at compile time
- deterministic lowering: same source + options => same CSV

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
<<< ../../snippets/pragmas/auto-cycle/01-minimal.edsl{openedge} [OpenEdgeDSL]
<<< ../../snippets/pragmas/auto-cycle/01-minimal.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/auto-cycle/01-minimal.csv`.

## Case B — Advanced options

::: code-group
<<< ../../snippets/pragmas/auto-cycle/02-advanced.edsl{openedge} [OpenEdgeDSL]
<<< ../../snippets/pragmas/auto-cycle/02-advanced.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/auto-cycle/02-advanced.csv`.

## Case C — Integration in kernel

::: code-group
<<< ../../snippets/pragmas/auto-cycle/04-integration.edsl{openedge} [OpenEdgeDSL]
<<< ../../snippets/pragmas/auto-cycle/04-integration.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/auto-cycle/04-integration.csv`.

## Case D — Edge / boundary

::: code-group
<<< ../../snippets/pragmas/auto-cycle/05-edge.edsl{openedge} [OpenEdgeDSL]
<<< ../../snippets/pragmas/auto-cycle/05-edge.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/auto-cycle/05-edge.csv`.

## Case E — Invalid usage

<<< ../../snippets/pragmas/auto-cycle/03-invalid.edsl{openedge-fail} [OpenEdgeDSL fail]

Expected: explicit diagnostic with source span and actionable hint.

## Lowering notes

Acts as optimizer hint; does not emit standalone ISA operations by itself.

## Related patterns

- Practical examples: [/examples/kernel-compaction](/examples/kernel-compaction)

- `schedulerMode` options in compiler API
- `std::stash(...)` for explicit save/restore boundaries
