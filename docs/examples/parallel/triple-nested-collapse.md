# Example: Triple Nested Loops with Collapse

[← Examples Index](../README.md) | [Main Index](../../README.md)

---

Demonstrates the difference between `collapse` (all levels) and `collapse(N)` (partial collapse) with 3 nested loops.

## Scenario: 3D Array Initialization

We want to initialize a 2x2x4 "3D array" (stored linearly) with computed indices.

```
Value at [i][j][k] = i*8 + j*4 + k
```

---

## Full Collapse (Default)

With `#pragma parallel collapse`, ALL 3 loop levels are collapsed into parallel execution:

<!-- expect: cycles<=2 -->
```c
.data result { 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0 }

kernel "TripleNestedFullCollapse" {
    config(0xF, 0);

    // 16 iterations (2x2x4) - ALL collapse into 1 cycle
    #pragma parallel collapse
    for i in range(2) {
        for j in range(2) {
            for k in range(4) {
                cycle { @i*2+j,k: SADD R0, ZERO, i*8+j*4+k; }
                cycle { @i*2+j,k: SWI R0, result[i*8+j*4+k]; }
            }
        }
    }

    cycle { @0,0: EXIT; }
}
```

**Result:**
- 16 total iterations collapsed
- Each iteration maps to a unique PE via `@i*2+j,k`
- Output: 2 cycles + EXIT = **3 cycles total**

**Grid layout per cycle:**
```
        col 0    col 1    col 2    col 3
row 0:  [0,0,0]  [0,0,1]  [0,0,2]  [0,0,3]   -> values 0,1,2,3    (@0,0 - @0,3)
row 1:  [0,1,0]  [0,1,1]  [0,1,2]  [0,1,3]   -> values 4,5,6,7    (@1,0 - @1,3)
row 2:  [1,0,0]  [1,0,1]  [1,0,2]  [1,0,3]   -> values 8,9,10,11  (@2,0 - @2,3)
row 3:  [1,1,0]  [1,1,1]  [1,1,2]  [1,1,3]   -> values 12,13,14,15 (@3,0 - @3,3)
```

---

## Partial Collapse with collapse(2)

With `#pragma parallel collapse(2)`, only the outer 2 loops (`i` and `j`) are collapsed. The innermost loop (`k`) remains sequential:

```c
.data result { 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0 }

kernel "TripleNestedCollapse2" {
    config(0xF, 0);

    // 4 iterations (2x2) collapse, each runs 4 sequential k iterations
    #pragma parallel collapse(2)
    for i in range(2) {
        for j in range(2) {
            for k in range(4) {
                cycle { @i*2+j,k: SADD R0, ZERO, i*8+j*4+k; }
                cycle { @i*2+j,k: SWI R0, result[i*8+j*4+k]; }
            }
        }
    }

    cycle { @0,0: EXIT; }
}
```

**Result:**
- 4 outer iterations (i,j) collapsed into parallel
- Each parallel iteration runs 4 sequential `k` iterations
- Output: 2 cycles × 4 k-iterations + EXIT = **9 cycles total**

**Execution pattern:**
```
Cycle 0-1: k=0 for all (i,j) pairs in parallel
  @0,0: value 0   @1,0: value 4   @2,0: value 8   @3,0: value 12

Cycle 2-3: k=1 for all (i,j) pairs in parallel
  @0,1: value 1   @1,1: value 5   @2,1: value 9   @3,1: value 13

Cycle 4-5: k=2 for all (i,j) pairs in parallel
  @0,2: value 2   @1,2: value 6   @2,2: value 10  @3,2: value 14

Cycle 6-7: k=3 for all (i,j) pairs in parallel
  @0,3: value 3   @1,3: value 7   @2,3: value 11  @3,3: value 15

Cycle 8: EXIT
```

---

## Comparison

| Pragma | Collapsed Loops | Sequential Loops | Total Cycles |
|--------|-----------------|------------------|--------------|
| `collapse` | i, j, k (all 3) | none | 3 |
| `collapse(2)` | i, j (outer 2) | k (inner) | 9 |
| `collapse(1)` | i (outer only) | j, k | 17 |
| No pragma | none | i, j, k | 33 |

---

## When to Use Partial Collapse

**Use `collapse(2)` when:**
- Inner loop has dependencies (e.g., accumulation)
- Grid size limits prevent full parallelization
- Memory access patterns require sequential ordering

**Example with inner loop dependency:**

```c
// Accumulate sum over k dimension
#pragma parallel collapse(2)
for i in range(2) {
    for j in range(2) {
        cycle { @i,j: SADD R0, ZERO, 0; }  // Initialize accumulator
        for k in range(4) {
            cycle { @i,j: LWI R1, data[i*8+j*4+k]; }
            cycle { @i,j: SADD R0, R0, R1; }  // R0 += data[i][j][k]
        }
        cycle { @i,j: SWI R0, result[i*2+j]; }  // Store sum
    }
}
```

Here `collapse(2)` is necessary because the `k` loop has a dependency (accumulating into R0).

---

## Navigation

- [← Examples Index](../README.md)
- [Main Index](../../README.md)
- [Pragma Parallel](../../features/pragmas/parallel.md)
