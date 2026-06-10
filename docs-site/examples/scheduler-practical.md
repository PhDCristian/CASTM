# Scheduler Practical Cases

This page shows measurable scheduler behavior using source-owned `build` configuration.

## What this demonstrates

- compaction impact from `scheduler_window`,
- safe branch-target remapping after bundle pruning,
- deterministic outcomes for fixed source settings.

## When to use

Use this page when you need concrete bundle-level expectations for scheduler settings.

## Target and assumptions

- all examples use canonical syntax with `target base;`.
- measurements are deterministic for a fixed source.

## CASTM ↔ CSV

::: code-group
<<< ../snippets/examples/scheduler-practical/01-main.castm{castm} [CASTM]
<<< ../snippets/examples/scheduler-practical/01-main.excerpt.csv{csv} [CSV (sim-matrix excerpt)]
:::

Full CSV: `docs-site/snippets/examples/scheduler-practical/01-main.csv`.

## Case 1: Window compaction

```castm
target base;
build { optimize O0; scheduler safe; scheduler_window 0; memory_reorder strict; prune_noop_bundles off; }
kernel "window_demo_o0" {
  bundle { at @0,0: SADD R1, R0, 1; }
  bundle { at @0,1: SADD R2, R0, 1; }
  bundle { at @0,2: SADD R3, R0, 1; }
}
```

```castm
target base;
build { optimize O2; scheduler safe; scheduler_window 1; memory_reorder strict; prune_noop_bundles on; }
kernel "window_demo_o2" {
  bundle { at @0,0: SADD R1, R0, 1; }
  bundle { at @0,1: SADD R2, R0, 1; }
  bundle { at @0,2: SADD R3, R0, 1; }
}
```

Typical behavior:

- `scheduler_window 0` => 3 bundles
- `scheduler_window 1` => 2 bundles
- `scheduler_window 2` => 1 bundle (when no hazards block compaction)

## Case 2: Branch remapping under compaction

```castm
target base;
build { optimize O2; scheduler safe; scheduler_window 1; memory_reorder strict; prune_noop_bundles on; }
kernel "branch_remap" {
  bundle { at @0,0: BEQ R0, 0, 3; }
  bundle { at @0,0: NOP; }
  bundle { at @0,1: SADD R2, R3, ZERO; }
  bundle { at @0,0: BNE R1, 0, 0; }
}
```

When a noop bundle is removed, numeric branch targets are remapped deterministically.

## Why this CSV looks like this

The generated matrix shows where compaction legally merged placements and where barriers (`BEQ`/`BNE`, memory fences, route hazards) forced bundle boundaries.

## Related features

- [/features/advanced-statements/auto-bundle](/features/advanced-statements/auto-bundle)
- [/features/advanced-statements/pipeline](/features/advanced-statements/pipeline)
- [/features/advanced-statements/route](/features/advanced-statements/route)
- [/features/advanced-statements/stash](/features/advanced-statements/stash)
- [/examples/scheduler-modes](/examples/scheduler-modes)
- [/examples/kernel-compaction](/examples/kernel-compaction)

## Continue

- Next: [/examples/kernel-compaction](/examples/kernel-compaction)
- All examples: [/examples/index](/examples/index)
