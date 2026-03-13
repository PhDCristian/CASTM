# Optimization Profiles on the Same Kernel

## What this demonstrates

- one identical kernel body compiled under different `optimize` profiles,
- how source-owned build settings change cycle packing,
- why explicit overrides can beat presets for specific kernels.

## When to use

Use this page when you want to compare `O0/O1/O2/O3` behavior on the same source, not on different examples.

## Target and assumptions

- all cases use `target base;`
- kernel body is identical in every case
- only `build { ... }` changes between cases
- CSV shown is generated from each snippet

## CASTM ↔ CSV

### Case A — `O0` (no compaction)

::: code-group
<<< ../snippets/examples/optimization-profiles/01-o0.castm{castm} [CASTM]
<<< ../snippets/examples/optimization-profiles/01-o0.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/examples/optimization-profiles/01-o0.csv`.

### Case B — `O1` (safe + small window)

::: code-group
<<< ../snippets/examples/optimization-profiles/02-o1.castm{castm} [CASTM]
<<< ../snippets/examples/optimization-profiles/02-o1.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/examples/optimization-profiles/02-o1.csv`.

### Case C — `O2` (balanced default)

::: code-group
<<< ../snippets/examples/optimization-profiles/03-o2.castm{castm} [CASTM]
<<< ../snippets/examples/optimization-profiles/03-o2.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/examples/optimization-profiles/03-o2.csv`.

### Case D — `O3` (aggressive preset)

::: code-group
<<< ../snippets/examples/optimization-profiles/04-o3.castm{castm} [CASTM]
<<< ../snippets/examples/optimization-profiles/04-o3.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/examples/optimization-profiles/04-o3.csv`.

### Case E — `O2` with explicit override

::: code-group
<<< ../snippets/examples/optimization-profiles/05-o2-window0.castm{castm} [CASTM]
<<< ../snippets/examples/optimization-profiles/05-o2-window0.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/examples/optimization-profiles/05-o2-window0.csv`.

## Why this CSV looks like this

The data path is the same in all five snippets; only scheduler policy changes.
This isolates optimization behavior and avoids confusion from feature differences.

Measured cycle counts (generated CSV headers):

| Case | Build config | Cycles |
|---|---|---:|
| A | `optimize O0` | `7` |
| B | `optimize O1` | `6` |
| C | `optimize O2` | `5` |
| D | `optimize O3` | `3` |
| E | `optimize O2; scheduler_window 0;` | `7` |

Typical interpretation:

- `O0`: no packing (`scheduler_window=0`, no noop pruning).
- `O1`: conservative one-step lookahead.
- `O2`: balanced packing (default profile).
- `O3`: larger packing horizon.
- `O2 + scheduler_window 0`: explicit override that disables packing even with `O2`.

## Related features

- [/language/configuration](/language/configuration)
- [/language/target-profiles](/language/target-profiles)
- [/features/loops](/features/loops)
- [/features/pragmas/auto-cycle](/features/pragmas/auto-cycle)
- [/features/pragmas/pipeline](/features/pragmas/pipeline)
- [/features/pragmas/stash](/features/pragmas/stash)
- [/examples/scheduler-modes](/examples/scheduler-modes)
- [/examples/scheduler-practical](/examples/scheduler-practical)

## Continue

- Next: [/examples/kernel-compaction](/examples/kernel-compaction)
- All examples: [/examples/index](/examples/index)
