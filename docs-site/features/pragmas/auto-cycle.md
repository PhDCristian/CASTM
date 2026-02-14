# `std::latency_hide(...)`

Deterministic post-expansion slot packing for safe latency hiding.

## Syntax

```text
std::latency_hide(window=1[, mode=conservative]);
```

## Options

| Key | Required | Default | Description |
|---|---|---|---|
| `window` | no | `1` | lookahead window for placement packing (`>=0`) |
| `mode` | no | `conservative` | compaction strategy |

## Hazard Guards

Placements are moved earlier only if all checks pass:

1. no PE occupancy collisions
2. no control/branch barriers are crossed
3. no direct route-hop dependency is crossed (`RCL/RCR/RCT/RCB/INCOMING`)
4. memory policy allows the move (`strict` or `same-address-fence`)

Additional guarantees:

- lexical order remains deterministic,
- numeric branch targets are remapped if noop cycles are removed.

## Example

```openedge
target "uma-cgra-base";
kernel "latency_hide_doc" {
  std::latency_hide(window=1, mode=conservative);
  cycle { at row 1: SMUL R2, R0, R1; }
  cycle { at @0,3: LWI R1, 4; }
}
```

## DSL to CSV Example (Matrix)

```csv [CSV matrix excerpt]
0,,,
NOP,NOP,NOP,"LWI R1, 4"
"SMUL R2, R0, R1",NOP,NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
```

## Practical cases

- measurable examples: [/examples/scheduler-practical](/examples/scheduler-practical)
