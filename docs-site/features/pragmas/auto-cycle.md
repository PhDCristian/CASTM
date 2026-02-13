# `std::latency_hide(...)`

Conservative post-expansion cycle compaction for safe latency hiding.

## Syntax

```text
std::latency_hide(window=1[, mode=conservative]);
```

## Options

| Key | Required | Default | Description |
|---|---|---|---|
| `window` | no | `1` | max local merge attempts per anchor cycle (`1..256`) |
| `mode` | no | `conservative` | compaction strategy |

## Hazard Guards

Two adjacent cycles are merged only if all checks pass:

1. no PE occupancy collisions
2. no control/branch barriers
3. no direct route-hop dependency
4. no adjacent dual-memory hazard

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
