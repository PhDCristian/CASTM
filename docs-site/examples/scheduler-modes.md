# Scheduler Modes

Scheduler behavior is configured in-source via `build { ... }`.
`slot-pack` stays deterministic for a fixed source.

## What this demonstrates

- scheduler presets from `optimize`,
- explicit scheduler overrides in source,
- deterministic behavior for the same source configuration.

## When to use

Use this page when you want to tune scheduler behavior without leaving the `.castm` source.

## Target and assumptions

- snippets use canonical syntax and include `target base;`.
- same source + same `build` scheduler fields => same CSV output.

## In-source configuration

```castm
target base;
build {
  optimize O2;
  scheduler balanced;
  scheduler_window auto;
  memory_reorder same_address_fence;
  prune_noop_cycles on;
}
kernel "sched_demo" {
  bundle { at @0,0: SADD R1, R0, 1; }
  bundle { at @0,1: SADD R2, R0, 1; }
}
```

## Preset mapping

- `O0` => `safe`, window `0`, `strict`, prune `off`
- `O1` => `safe`, window `1`, `strict`, prune `on`
- `O2` => `balanced`, window `2`, `same_address_fence`, prune `on`
- `O3` => `aggressive`, window `4`, `same_address_fence`, prune `on`

Explicit keys in `build` override preset values.

## CASTM ↔ CSV

::: code-group
<<< ../snippets/examples/scheduler-modes/01-main.castm{castm} [CASTM]
<<< ../snippets/examples/scheduler-modes/01-main.excerpt.csv{csv} [CSV (sim-matrix excerpt)]
:::

Full generated CSV: `docs-site/snippets/examples/scheduler-modes/01-main.csv`.

## Why this CSV looks like this

The snippet contains two independent placements on different PEs. With balanced defaults (`O2`), slot packing can keep the cycle budget minimal while preserving deterministic ordering and hazards.

## Related features

- [/features/pragmas/auto-cycle](/features/pragmas/auto-cycle)
- [/features/pragmas/pipeline](/features/pragmas/pipeline)
- [/features/pragmas/stash](/features/pragmas/stash)
- [/language/compilation](/language/compilation)
- [/examples/scheduler-practical](/examples/scheduler-practical)

## Continue

- Next: [/examples/scheduler-practical](/examples/scheduler-practical)
- All examples: [/examples/index](/examples/index)
