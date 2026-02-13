# `std::shift(...)`

Directional lane shift with explicit edge fill.

## Syntax

```text
std::shift(reg=R0, direction=left|right[, distance=N][, fill=IMM]);
```

## Options

| Key | Required | Default | Description |
|---|---|---|---|
| `reg` | yes | - | register to shift |
| `direction` | yes | - | `left` or `right` |
| `distance` | no | `1` | shift distance |
| `fill` | no | `0` | edge fill value |

## Semantics

Each shift step emits two cycles:

1. route send stage (`SADD ROUT, reg, ZERO`)
2. receive/fill stage:
   - edge column gets `fill`
   - inner columns read directional incoming

## Executable Example

```openedge
target "uma-cgra-base";
kernel "shift_doc" {
  std::shift(reg=R0, direction=right, distance=1, fill=0);
}
```

## DSL to CSV Example (Matrix)

```csv [CSV matrix excerpt]
0,,,
"SADD ROUT, R0, ZERO","SADD ROUT, R0, ZERO","SADD ROUT, R0, ZERO","SADD ROUT, R0, ZERO"
"SADD ROUT, R0, ZERO","SADD ROUT, R0, ZERO","SADD ROUT, R0, ZERO","SADD ROUT, R0, ZERO"
"SADD ROUT, R0, ZERO","SADD ROUT, R0, ZERO","SADD ROUT, R0, ZERO","SADD ROUT, R0, ZERO"
"SADD ROUT, R0, ZERO","SADD ROUT, R0, ZERO","SADD ROUT, R0, ZERO","SADD ROUT, R0, ZERO"
1,,,
"SADD R0, ZERO, 0","SADD R0, RCL, ZERO","SADD R0, RCL, ZERO","SADD R0, RCL, ZERO"
"SADD R0, ZERO, 0","SADD R0, RCL, ZERO","SADD R0, RCL, ZERO","SADD R0, RCL, ZERO"
"SADD R0, ZERO, 0","SADD R0, RCL, ZERO","SADD R0, RCL, ZERO","SADD R0, RCL, ZERO"
"SADD R0, ZERO, 0","SADD R0, RCL, ZERO","SADD R0, RCL, ZERO","SADD R0, RCL, ZERO"
```
