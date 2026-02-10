---
title: Stencil Operations
outline: deep
---

# Stencil Operations

Examples of stencil and neighbor-based operations using pragma directives.

## Cross Stencil

Apply a cross-shaped stencil pattern (sum of 4 neighbors):

```c
kernel "CrossStencil" {
    config(0xF, 0);

    // Initialize each PE with its ID
    #pragma parallel collapse(2)
    for i in range(4) {
        for j in range(4) {
            cycle {
                @i,j: SADD R0, ZERO, IMM(i * 4 + j);
            }
        }
    }

    // Apply cross stencil: R1 = sum of 4 neighbors
    #pragma stencil(cross, add, R0, R1)

    cycle { @0,0: EXIT; }
}
```

---

## Array Expressions with Stencil

Using 2D named arrays with stencil patterns:

```c
.array A[4][4] {
    1,  2,  3,  4,
    5,  6,  7,  8,
    9,  10, 11, 12,
    13, 14, 15, 16
}

kernel "ArrayStencil" {
    config(0xF, 0);

    // Load from 2D array
    #pragma parallel collapse(2)
    for i in range(4) {
        for j in range(4) {
            cycle {
                @i,j: LWI R0, A[i][j];
            }
        }
    }

    #pragma stencil(cross, add, R0, R1)

    // Store results
    #pragma parallel collapse(2)
    for i in range(4) {
        for j in range(4) {
            cycle {
                @i,j: SWD R1;
            }
        }
    }

    cycle { @0,0: EXIT; }
}
```
