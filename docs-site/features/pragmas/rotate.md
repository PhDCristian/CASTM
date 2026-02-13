# `rotate(...)`

Toroidal lane rotation using route relay steps.

## Syntax

```text
rotate(reg=R0, direction=left|right[, distance=N]);
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

`rotate(...)` requires torus topology.

## Executable Example

```openedge
target "uma-cgra-base";
kernel "rotate_doc" {
  rotate(reg=R0, direction=left, distance=1);
}
```

## Diagnostics

Using `rotate(...)` on non-torus topology emits `UnsupportedOperation` diagnostics.
