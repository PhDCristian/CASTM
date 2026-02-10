# Memory Load/Store Sugar

[← C-like Expressions](clike-expressions.md) | [Main Index](../README.md)

---

OpenEdge-DSL supports C-style sugar for memory load/store inside `cycle {}` blocks.
The compiler desugars these forms to `LWI`/`SWI` without changing generated ISA.

## Syntax

```c
R3 = A[i];          // LWI R3, A[i]
A[i] = R3;          // SWI R3, A[i]

R2 = [360 + i*4];   // LWI R2, IMM(360 + i*4)
[360 + i*4] = R2;   // SWI R2, IMM(360 + i*4)
```

## Supported Memory Operands

- Named arrays: `A[i]`
- 2D arrays: `M[i][j]`
- Raw address expressions: `[expr]`

## Rules

1. Sugar is only active inside `cycle {}`.
2. Load destination must be a register (`R0`-`R3`, `ROUT`).
3. Store source must be a register (`R0`-`R3`, `ROUT`).
4. Memory-to-memory assignment is rejected (`A[i] = B[j]`).

## Examples

```c
.data input  { 10, 20, 30, 40 }
.data output {  0,  0,  0,  0 }

kernel "MemSugar" {
    config(0xF, 0);

    for i in range(4) {
        cycle { @0,i: R0 = input[i]; }
        cycle { @0,i: output[i] = R0; }
    }

    cycle { @0,0: EXIT; }
}
```

---

## Navigation

- [← C-like Expressions](clike-expressions.md)
- [Main Index](../README.md)
