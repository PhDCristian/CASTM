# `pipeline(...)`

## When to use

Use ordered composition of function stages while keeping each stage reusable and isolated.

## Target and assumptions

All executable snippets below are canonical and explicit:

- `target base;`
- default grid: `4x4` toroidal profile unless overridden in `build { ... }`
- deterministic lowering: same source => same CSV

## Syntax

```text
pipeline(stageA(...), stageB(...), stageC(...));
```

## Parameters

| Parameter | Required | Description |
|---|---|---|
| `stages` | yes | Ordered function calls executed in lexical sequence. |

Important:

- `pipeline(...)` is a sequencing macro, not a hidden dataflow graph.
- Registers are local per PE. Reusing `R1`/`R2` names across different coordinates does not create a dependency by itself.

## Case A — Minimal

::: code-group
<<< ../../snippets/pragmas/pipeline/01-minimal.castm{castm} [CASTM]
<<< ../../snippets/pragmas/pipeline/01-minimal.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/pipeline/01-minimal.csv`.

## Case B — Advanced options

### B1 — Source-configured safe profile (`scheduler_window=1`)

::: code-group
<<< ../../snippets/pragmas/pipeline/02-advanced.castm{castm} [CASTM]
<<< ../../snippets/pragmas/pipeline/02-advanced.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/pipeline/02-advanced.csv`.

Interpretation:

- stages are placed on different PEs (`@0,0`, `@0,1`, `@0,2`),
- the scheduler compacts with one-cycle lookahead,
- first two placements may end in cycle `0`, while the third stays in cycle `1`.

### B2 — Same DSL with source override (`build { scheduler_window 2; }`)

Expected effect for this specific source: `1` cycle.

::: code-group
<<< ../../snippets/pragmas/pipeline/02-window2.castm{castm} [CASTM]
<<< ../../snippets/pragmas/pipeline/02-window2.excerpt.csv{csv} [CSV excerpt (`scheduler_window=2`)]
:::

Full CSV: `docs-site/snippets/pragmas/pipeline/02-window2.csv`.

Where this is configured:

- In source `build { ... }`, not in external compile overrides.
- See:
  - [/language/compilation](/language/compilation)
  - [/guide/library-usage](/guide/library-usage)

## Case C — Integration in kernel

::: code-group
<<< ../../snippets/pragmas/pipeline/04-integration.castm{castm} [CASTM]
<<< ../../snippets/pragmas/pipeline/04-integration.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/pipeline/04-integration.csv`.

## Case D — Edge / boundary

::: code-group
<<< ../../snippets/pragmas/pipeline/05-edge.castm{castm} [CASTM]
<<< ../../snippets/pragmas/pipeline/05-edge.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/pragmas/pipeline/05-edge.csv`.

Interpretation:

- This edge case keeps all stages on the same PE (`@0,0`), forming a true per-PE register chain (`R1 -> R2 -> R3`).
- Since one PE can execute one instruction per cycle, these stages cannot collapse into the same cycle.

## Case E — Invalid usage

<<< ../../snippets/pragmas/pipeline/03-invalid.castm{castm-fail} [CASTM fail]

Expected: explicit diagnostic with source span and actionable hint.

## Lowering notes

`pipeline(...)` first expands stages in strict lexical order (one logical stage after another).  
After that, scheduler compaction may merge placements into earlier cycles when legal.

For the `Case B` example:

- Raw expansion is 3 cycles (`s0`, `s1`, `s2`).
- Source `build { scheduler safe; scheduler_window 1; }` uses window `1`.
- With `window=1`, `s1` can move from cycle 1 to cycle 0, and `s2` can move from cycle 2 to cycle 1.
- So `s2` appears in cycle 1 (not cycle 0) by design.

Compaction horizon summary (same source):

- `scheduler_window 0` -> 3 cycles
- `scheduler_window 1` -> 2 cycles
- `scheduler_window >= 2` -> 1 cycle

This is deterministic behavior, not a pipeline semantic bug.
`safe` mode is conservative for control/memory, but no longer blocks legal `ROUT` writer compaction when no route hazards are crossed.

## Related patterns

- Practical examples: [/examples/kernel-compaction](/examples/kernel-compaction)

- `function` definitions for reusable blocks
- `std::latency_hide(...)` for post-lowering compaction hints
- Scheduler behavior and options: [/examples/scheduler-modes](/examples/scheduler-modes)
