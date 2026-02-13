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
    cycle { at @0,1: R2 = R0 + 1; }
  }
}
```

## DSL to CSV Example (Matrix)

```csv [CSV matrix excerpt]
0,,,
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
1,,,
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
2,,,
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
3,,,
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
4,,,
"SADD R0, ZERO, ZERO",NOP,NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
5,,,
"BGE R0, 2, 7","SADD R3, RCL, ZERO",NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
```
