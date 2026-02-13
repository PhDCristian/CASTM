# Loop Expansion Model

OpenEdgeDSL supports both static and runtime loop expansion in canonical syntax.

## Static Expansion

`for i in range(a, b[, step]) { ... }` expands at compile time.

## Runtime Expansion

`for Rn in range(a, b[, step]) at @r,c runtime { ... }` lowers with explicit control logic.

## Example

```openedge
target "uma-cgra-base";
kernel "loop_model" {
  for i in range(0, 4) {
    cycle { @0,i: NOP; }
  }

  for R0 in range(0, 2) at @0,0 runtime {
    cycle { at @0,1: R2 = R0 + IMM(1); }
  }
}
```
