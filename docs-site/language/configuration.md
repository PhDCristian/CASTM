# Configuration In Source

OpenEdgeDSL configuration is source-owned.  
You configure target and scheduling inside `.edsl`, not in external compiler flags.

## What is `target base;`?

`base` is the canonical user alias for the default OpenEdge CGRA profile.

- Write: `target base;`
- Internal resolver maps it to the baseline profile ID.
- You should not need to remember internal IDs in normal authoring.

Target details and profile authoring:
- [Target Profiles](/language/target-profiles)

## Minimal Configuration

```openedge
target base;

kernel "minimal" {
  cycle { at @0,0: SADD R1, R0, 1; }
}
```

## Recommended Build Block

```openedge
target base;

build {
  optimize O2;
  scheduler balanced;
  scheduler_window auto;
  memory_reorder same_address_fence;
  prune_noop_cycles on;
  grid 4x4 torus;
}

kernel "configured" {
  cycle { at @0,0: SADD R1, R0, 1; }
}
```

## Presets (`optimize`)

| Preset | Scheduler | Window | Memory Reorder | Prune Noop Cycles |
|---|---|---|---|---|
| `O0` | `safe` | `0` | `strict` | `off` |
| `O1` | `safe` | `1` | `strict` | `on` |
| `O2` | `balanced` | `2` | `same_address_fence` | `on` |
| `O3` | `aggressive` | `4` | `same_address_fence` | `on` |

Rule: explicit keys inside `build { ... }` override preset values.

## Practical Recipes

### Stable debugging

```openedge
target base;
build {
  optimize O0;
}
kernel "stable_debug" {
  cycle { at @0,0: SADD R1, R0, 1; }
}
```

### Good default for development

```openedge
target base;
build {
  optimize O2;
}
kernel "dev_default" {
  cycle { at @0,0: SADD R1, R0, 1; }
}
```

### Max compaction attempts

```openedge
target base;
build {
  optimize O3;
  scheduler_window 6; // explicit override
}
kernel "max_compaction" {
  cycle { at @0,0: SADD R1, R0, 1; }
}
```

## Runtime Statements (same source-owned model)

```openedge
target base;
kernel "runtime_cfg" {
  io.load(0, 4, 8);
  io.store(100, 104);
  limit(128);
  assert(at=@0,0, reg=R0, equals=0, cycle=0);
}
```

## Related

- [Program Structure](/language/program-structure)
- [Compilation Pipeline](/language/compilation)
- [Library Usage](/guide/library-usage)
