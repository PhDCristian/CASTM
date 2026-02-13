# Loop Expansion Model

OpenEdgeDSL supports static loop expansion plus canonical loop strategy modifiers.

## Static Expansion

- `for i in range(a, b[, step]) { ... }`
- `for i in range(a, b[, step]) unroll(k) { ... }`
- `for i in range(a, b[, step]) collapse(n) { ... }`
- `for i in range(a, b[, step]) unroll(k) collapse(n) { ... }`

## Runtime Expansion

- `for Rn in range(a, b[, step]) at @r,c runtime { ... }`

Runtime loops require explicit control PE and currently do not accept `unroll(...)` or `collapse(...)`.

## Example (`collapse(2)`)

```openedge
target "uma-cgra-base";
kernel "loop_model" {
  for r in range(0, 2) collapse(2) {
    for c in range(0, 2) {
      cycle { at @r,c: R3 = R1 + R2; }
    }
  }
}
```

## DSL to CSV Example (Matrix)

```csv [CSV matrix excerpt]
0,,,
"SADD R3, R1, R2",NOP,NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
1,,,
NOP,"SADD R3, R1, R2",NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
2,,,
NOP,NOP,NOP,NOP
"SADD R3, R1, R2",NOP,NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
3,,,
NOP,NOP,NOP,NOP
NOP,"SADD R3, R1, R2",NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
```

## Example (`unroll(2)`)

```openedge
target "uma-cgra-base";
kernel "loop_model_unroll" {
  for i in range(0, 4) unroll(2) {
    cycle { at @0,i: R2 = R0 + 1; }
  }
}
```

```csv [CSV matrix excerpt]
0,,,
"SADD R2, R0, 1",NOP,NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
1,,,
NOP,"SADD R2, R0, 1",NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
2,,,
NOP,NOP,"SADD R2, R0, 1",NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
3,,,
NOP,NOP,NOP,"SADD R2, R0, 1"
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
```
