---
title: Parallel Patterns
outline: deep
---

# Parallel Patterns

Examples demonstrating SIMD-style parallelism, reductions, and multi-PE computation.

## Parallel Sum

Using `#pragma parallel` for SIMD-like execution across all PEs:

```c
.data 0 { 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16 }

kernel "ParallelSum" {
    config(0xF, 0);

    #pragma parallel
    for i in range(4) {
        for j in range(4) {
            cycle {
                @i,j: LWI R0, data[i * 4 + j];
            }
        }
    }

    #pragma reduce(sum, R1, R0)

    cycle { @0,0: SWD R1; }
    cycle { @0,0: EXIT; }
}
```

---

## Tree Reduction

Explicit tree reduction across the 4×4 grid:

```c
kernel "Reduction" {
    config(0xF, 0);

    // Load values into all PEs
    #pragma parallel collapse(2)
    for i in range(4) {
        for j in range(4) {
            cycle {
                @i,j: SADD R0, ZERO, IMM(i * 4 + j + 1);
            }
        }
    }

    // Tree reduction: sum
    #pragma reduce(sum, R1, R0)

    cycle { @0,0: ASSERT R1, 136; }
    cycle { @0,0: EXIT; }
}
```

**Expected:** 1 + 2 + ... + 16 = 136

---

## Conditional Diff

For loop with index arithmetic for pairwise operations:

```c
.data 0 { 10, 20, 5, 3, 15, 10 }

kernel "ConditionalDiff" {
    config(0xF, 0);

    for i in range(3) {
        cycle { @0,0: LWI R0, data[i]; }
        cycle { @0,0: LWI R1, data[3 + i]; }
        cycle { @0,0: SSUB R2, R0, R1; }
        cycle { @0,0: SWD R2; }
    }

    cycle { @0,0: EXIT; }
}
```

**Results:** diff[0]=7, diff[1]=5, diff[2]=-5

---

## Triple-Nested Collapse

`#pragma parallel collapse(3)` for deep loop nesting:

```c
kernel "TripleNested" {
    config(0xF, 0);

    #pragma parallel collapse(2)
    for i in range(4) {
        for j in range(4) {
            cycle {
                @i,j: SADD R0, ZERO, IMM(i * 4 + j);
            }
        }
    }

    cycle { @0,0: EXIT; }
}
```
