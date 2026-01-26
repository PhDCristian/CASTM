# Dynamic PE Coordinates

[← For Loops](loops/for-loops.md) | [Main Index](../README.md) | [Next: Pragmas →](pragmas/README.md)

---

Dynamic coordinates allow loop variables to be used in PE location specifiers (`@row,col:`), enabling compile-time placement of instructions across the grid.

## Syntax

```c
@<expr>,<expr>: INSTRUCTION;
```

Where `<expr>` can be:
- A loop variable: `i`, `j`, `k`
- A constant: `N`, `SIZE`
- An arithmetic expression: `i+1`, `j*2`, `k%4`, `N-1`

**Note:** Coordinates are specified as `@row,col` where the first expression is the row and the second is the column.

---

## Basic Example: Sequential Expansion

Without `#pragma parallel`, each iteration generates a separate cycle with the instruction at the computed coordinate.

<!-- expect: cycles<=5 -->
```c
kernel "DynamicCoordSequential" {
    config(0xF, 0);

    // Generates 4 cycles, each with instruction at different row
    for i in range(4) {
        cycle {
            @i,0: SADD R0, ZERO, i;  // @0,0 then @1,0 then @2,0 then @3,0
        }
    }

    cycle { @0,0: EXIT; }
}
```

---

## Parallel Expansion with Dynamic Coordinates

With `#pragma parallel collapse` and dynamic coordinates, all iterations **collapse** into the same cycle(s), each at their computed coordinate.

<!-- expect: cycles<=2 -->
```c
kernel "DynamicCoordParallel" {
    config(0xF, 0);

    // All 4 iterations collapse into 1 cycle
    #pragma parallel collapse
    for i in range(4) {
        cycle {
            @i,0: SADD R0, ZERO, i;  // All 4 PEs execute in parallel
        }
    }

    cycle { @0,0: EXIT; }
}
```

---

## Full Grid Parallelization

The most powerful use case: using linear-to-2D mapping to initialize the entire grid in parallel.

<!-- expect: cycles<=2 -->
```c
kernel "FullGridParallel" {
    config(0xF, 0);

    // 16 iterations mapped to 4x4 grid, all in 1 cycle
    #pragma parallel collapse
    for k in range(16) {
        cycle {
            @k/4,k%4: SADD R0, ZERO, k;  // k=0→(0,0), k=5→(1,1), etc.
        }
    }

    cycle { @0,0: EXIT; }
}
```

---

## Coordinate Expressions

### Offset Expression (`@i+1,j`)

```c
// Process rows 1-3, leaving row 0 for control
#pragma parallel collapse
for i in range(3) {
    cycle {
        @i+1,0: SADD R0, ZERO, i;  // Executes at rows 1, 2, 3
    }
}
```

### Stride Expression (`@i*2,j`)

```c
// Process only even rows (0, 2)
#pragma parallel collapse
for i in range(2) {
    cycle {
        @i*2,0: SADD R0, ZERO, i;  // Executes at rows 0, 2
    }
}
```

### Modulo Expression (`@k%4,k/4`)

Maps a linear index to 2D grid coordinates (see Full Grid Parallelization example above).

### Axis Transposition (`@j,i`)

Swap row and column assignment:

```c
// Outer loop controls row, inner loop controls column
for i in range(4) {
    for j in range(4) {
        cycle {
            @j,i: SADD R0, ZERO, i;  // Transposed: j (col) as row, i (row) as col
        }
    }
}
```

---

## Complete Example: Matrix Initialization

The original slow code:

```c
// SLOW: 49 cycles (16 iterations × 3 cycles + EXIT)
for i in range(4) {
    for j in range(4) {
        cycle { @0,0: SADD R0, ZERO, i; }
        cycle { @0,0: SADD R0, R0, j; }
        cycle { @0,0: SWI R0, A[i*4+j]; }
    }
}
```

Optimized with dynamic coordinates:

<!-- expect: cycles<=5 -->
```c
.data A { 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0 }

kernel "MatrixInitOptimized" {
    config(0xF, 0);

    // FAST: 4 cycles (3 parallel + EXIT)
    // Using k/4,k%4 to map linear index to 2D coordinates (row,col)
    #pragma parallel collapse
    for k in range(16) {
        cycle { @k/4,k%4: SADD R0, ZERO, k/4; }    // 1 cycle, 16 PEs
        cycle { @k/4,k%4: SADD R0, R0, k%4; }      // 1 cycle, 16 PEs
        cycle { @k/4,k%4: SWI R0, A[k]; }          // 1 cycle, 16 PEs
    }

    cycle { @0,0: EXIT; }
}
```

**Speedup**: 49 cycles → 4 cycles = **12.25x faster**

---

## Complete Example: Matrix Addition (A + B = C)

This example demonstrates full CGRA utilization with nested loops operating on two input matrices.

### Sequential Version (Slow)

```c
// SLOW: 65 cycles (16 iterations × 4 cycles + EXIT)
// Each element processed one at a time on PE (0,0)
for i in range(4) {
    for j in range(4) {
        cycle { @0,0: LWI R0, A[i*4+j]; }   // Load A[i][j]
        cycle { @0,0: LWI R1, B[i*4+j]; }   // Load B[i][j]
        cycle { @0,0: SADD R2, R0, R1; }    // R2 = A + B
        cycle { @0,0: SWI R2, C[i*4+j]; }   // Store to C[i][j]
    }
}
```

### Parallel Version (Full CGRA Utilization)

Using a linear index `k` with `k%4` (column) and `k/4` (row) mapping, all 16 PEs process one matrix element each:

<!-- expect: cycles<=6 -->
```c
.data A { 1,2,3,4, 5,6,7,8, 9,10,11,12, 13,14,15,16 }
.data B { 10,20,30,40, 50,60,70,80, 90,100,110,120, 130,140,150,160 }
.data C { 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0 }

kernel "MatrixAddLinear" {
    config(0xF, 0);

    // Single loop with k/4,k%4 mapping (row,col)
    #pragma parallel collapse
    for k in range(16) {
        cycle { @k/4,k%4: LWI R0, A[k]; }
        cycle { @k/4,k%4: LWI R1, B[k]; }
        cycle { @k/4,k%4: SADD R2, R0, R1; }
        cycle { @k/4,k%4: SWI R2, C[k]; }
    }

    cycle { @0,0: EXIT; }
}
```

**Index to Coordinate Mapping**:
- `k=0` → `@k/4,k%4` = `@0,0` (row 0, col 0)
- `k=5` → `@k/4,k%4` = `@1,1` (row 1, col 1)
- `k=15` → `@k/4,k%4` = `@3,3` (row 3, col 3)

**Grid Layout** (each PE processes one element):
```
        col 0    col 1    col 2    col 3
row 0:  k=0      k=1      k=2      k=3
row 1:  k=4      k=5      k=6      k=7
row 2:  k=8      k=9      k=10     k=11
row 3:  k=12     k=13     k=14     k=15
```

**Result in C**: `{ 11,22,33,44, 55,66,77,88, 99,110,121,132, 143,154,165,176 }`

**Speedup**: 65 cycles → 5 cycles = **13x faster**

### Alternative: Using Nested Loops (More Readable)

The same operation using nested `for i` and `for j` loops - clearer mapping to matrix indices:

<!-- expect: cycles<=6 -->
```c
.data A { 1,2,3,4, 5,6,7,8, 9,10,11,12, 13,14,15,16 }
.data B { 10,20,30,40, 50,60,70,80, 90,100,110,120, 130,140,150,160 }
.data C { 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0 }

kernel "MatrixAddNested" {
    config(0xF, 0);

    // Nested loops with @i,j coordinates (row=i, col=j)
    // 'collapse' modifier applies parallelization to ALL nested loops
    #pragma parallel collapse
    for i in range(4) {
        for j in range(4) {
            cycle { @i,j: LWI R0, A[i*4+j]; }
            cycle { @i,j: LWI R1, B[i*4+j]; }
            cycle { @i,j: SADD R2, R0, R1; }
            cycle { @i,j: SWI R2, C[i*4+j]; }
        }
    }

    cycle { @0,0: EXIT; }
}
```

This is equivalent to the linear index version but more intuitive for matrix operations. The `collapse` modifier (similar to OpenMP's collapse clause) expands all nested loop iterations and collapses them into parallel cycles.

---

## Behavior Summary

| Context | Behavior |
|---------|----------|
| `for i ... { @i,j: ... }` (no pragma) | Sequential: each iteration = separate cycle |
| `#pragma parallel` + `@0,0:` (static coords) | Wave distribution: iterations distributed across columns |
| `#pragma parallel collapse` + `@i,j:` | Collapse: all iterations merged into same cycle(s) |
| `@i+1,j*2:` | Expression evaluated at compile time for each iteration |

**Note:** Coordinates are always specified as `@row,col` format.

---

## Limitations

- Coordinates must evaluate to valid grid positions (0 to grid_size-1)
- Out-of-bounds coordinates generate compile-time errors
- Division by zero in coordinate expressions generates errors
- With `#pragma parallel`, coordinate collisions (same PE in multiple iterations) generate errors

---

## Related

- [For Loops](loops/for-loops.md) - Basic loop syntax
- [Pragma Parallel](pragmas/parallel.md) - Parallel execution pragma
- [Named Arrays](named-arrays.md) - Data array syntax used in examples
