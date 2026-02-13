# `std::rotate(...)`

Toroidal lane rotation using route relay steps.

## Syntax

```text
std::rotate(reg=R0, direction=left|right[, distance=N]);
```

## Options

| Key | Required | Default | Description |
|---|---|---|---|
| `reg` | yes | - | register to rotate |
| `direction` | yes | - | `left` or `right` |
| `distance` | no | `1` | rotation distance |

## Semantics

Each rotation step emits two cycles:

1. `SADD ROUT, reg, ZERO` on all placements
2. `SADD reg, incoming, ZERO` with directional incoming register

`std::rotate(...)` requires torus topology.

## Executable Example

```openedge
target "uma-cgra-base";
kernel "rotate_doc" {
  std::rotate(reg=R0, direction=left, distance=1);
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
"SADD R0, RCR, ZERO","SADD R0, RCR, ZERO","SADD R0, RCR, ZERO","SADD R0, RCR, ZERO"
"SADD R0, RCR, ZERO","SADD R0, RCR, ZERO","SADD R0, RCR, ZERO","SADD R0, RCR, ZERO"
"SADD R0, RCR, ZERO","SADD R0, RCR, ZERO","SADD R0, RCR, ZERO","SADD R0, RCR, ZERO"
"SADD R0, RCR, ZERO","SADD R0, RCR, ZERO","SADD R0, RCR, ZERO","SADD R0, RCR, ZERO"
```

## Diagnostics

Using `std::rotate(...)` on non-torus topology emits `UnsupportedOperation` diagnostics.
