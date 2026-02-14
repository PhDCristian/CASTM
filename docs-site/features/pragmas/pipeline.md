# `pipeline(...)`

## When to use

Use ordered composition of function stages while keeping each stage reusable and isolated.

## Target and assumptions

All executable snippets below are canonical and explicit:

- `target "uma-cgra-base";`
- default grid: `4x4` toroidal profile unless overridden at compile time
- deterministic lowering: same source + options => same CSV

## Syntax

```text
pipeline(stageA(...), stageB(...), stageC(...));
```

## Parameters

| Parameter | Required | Description |
|---|---|---|
| `stages` | yes | Ordered function calls executed in lexical sequence. |

## Case A — Minimal

::: code-group
<<< ../../snippets/pragmas/pipeline/01-minimal.edsl{openedge} [OpenEdgeDSL]
<<< ../../snippets/pragmas/pipeline/01-minimal.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/pipeline/01-minimal.csv`.

## Case B — Advanced options

::: code-group
<<< ../../snippets/pragmas/pipeline/02-advanced.edsl{openedge} [OpenEdgeDSL]
<<< ../../snippets/pragmas/pipeline/02-advanced.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/pipeline/02-advanced.csv`.

## Case C — Integration in kernel

::: code-group
<<< ../../snippets/pragmas/pipeline/04-integration.edsl{openedge} [OpenEdgeDSL]
<<< ../../snippets/pragmas/pipeline/04-integration.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/pipeline/04-integration.csv`.

## Case D — Edge / boundary

::: code-group
<<< ../../snippets/pragmas/pipeline/05-edge.edsl{openedge} [OpenEdgeDSL]
<<< ../../snippets/pragmas/pipeline/05-edge.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/pipeline/05-edge.csv`.

## Case E — Invalid usage

<<< ../../snippets/pragmas/pipeline/03-invalid.edsl{openedge-fail} [OpenEdgeDSL fail]

Expected: explicit diagnostic with source span and actionable hint.

## Lowering notes

Expands function calls in strict lexical order; stage boundaries remain explicit in emitted cycles.

## Related patterns

- Practical examples: [/examples/kernel-compaction](/examples/kernel-compaction)

- `function` definitions for reusable blocks
- `std::latency_hide(...)` for post-lowering compaction hints
