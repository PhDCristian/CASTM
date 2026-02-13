# Spatial-Temporal Model

OpenEdgeDSL maps source operations to space (`row,col`) and time (`cycle index`).

## Spatial Placement

Canonical forms inside `cycle`:

- `at @r,c: INSTR;`
- `@r,c: INSTR;` (short canonical point form)
- `at row N: INSTR;`
- `at col N: INSTR;`
- `at all: INSTR;`

Coordinate expressions and ranges are supported:

- computed coordinates in loops: `@k/4,k%4`
- inclusive ranges: `@0,0..3`, `@0..1,2`, `@0..1,0..1`

## Temporal Ordering

- Each `cycle { ... }` contributes one or more placements at a cycle index.
- Advanced statements can emit multiple generated cycles.
- `latency_hide(...)` may compact adjacent cycles conservatively when hazards are absent.

## Executable Snippet

```openedge
target "uma-cgra-base";
kernel "space_time" {
  for k in range(0, 16) {
    cycle { @k/4,k%4: NOP; }
  }
  cycle { @0,0: R0 = R0 + 1; @0,1: R1 = R1 + 1; }
}
```
