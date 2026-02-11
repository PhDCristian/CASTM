# Pragma Parallel

[← Unroll](unroll.md) | [Main Index](../../README.md) | [Next: Reduce →](reduce.md)

---

The `#pragma parallel` directive distributes **independent** loop iterations across multiple PE columns, executing them simultaneously in the same cycle.

## Syntax

```c
#pragma parallel
for <var> in range(<end>) {
    // Body with @row,col: syntax
}
```

### With Collapse Modifier

```c
#pragma parallel collapse
for <var> in range(<end>) {
    // Body with dynamic coordinates (@row,var:)
}
```

### With Collapse(N) - Partial Collapse

```c
#pragma parallel collapse(N)
for <outer> in range(<end>) {
    for <inner> in range(<end>) {
        // Only N levels are collapsed
    }
}
```

The `collapse` modifier (similar to OpenMP's collapse clause) collapses all loop iterations into the same cycle(s) when using dynamic coordinates like `@i,j:`. The optional argument `N` specifies how many nested loop levels to collapse (default: all levels).

---

## Requirements

- **Loop iterations must be independent** (no data dependencies)
- **Body must use `@row,col:` syntax** (not `row N:`)
- **Maximum parallelism** = grid width (default 4 columns)
- **Single PE per iteration**: Body code is replicated across columns

---

## How It Works

The compiler:
1. **Parses** loop body to identify cycle blocks and if-else patterns
2. **Distributes** iterations across columns (i=0 → Col 0, i=1 → Col 1, etc.)
3. **Substitutes** data references (`data[i]` → computed address per column)
4. **Converts** if-else blocks to BSFA instructions
5. **Generates waves** if iterations > grid width

---

## Basic Example

```c
.data 0 { 1, 2, 3, 4 }
.io_store { 100, 104, 108, 112 }

kernel "ParallelSum" {
    config(0xF, 0);

    #pragma parallel
    for i in range(4) {
        cycle { @0,0: LWI R0, data[i]; }
        cycle { @0,0: SADD ROUT, R0, R0; }
        cycle { @0,0: SWD ROUT; }
    }

    cycle { @0,0: EXIT; }
}
```

**Compiles to (4 cycles instead of 13):**

```c
// Cycle 0: Load all elements in parallel
cycle {
    @0,0: LWI R0, data[0];
    @1,0: LWI R0, data[1];
    @2,0: LWI R0, data[2];
    @3,0: LWI R0, data[3];
}

// Cycle 1: Compute all in parallel
cycle {
    @0,0: SADD ROUT, R0, R0;
    @1,0: SADD ROUT, R0, R0;
    @2,0: SADD ROUT, R0, R0;
    @3,0: SADD ROUT, R0, R0;
}

// Cycle 2: Store all in parallel
cycle {
    @0,0: SWD ROUT;
    @1,0: SWD ROUT;
    @2,0: SWD ROUT;
    @3,0: SWD ROUT;
}

// Cycle 3: Exit
cycle { @0,0: EXIT; }
```

**Speedup:** 3.25x (13 → 4 cycles)

---

## Conditional Handling (If-Else to BSFA)

When if-else blocks are present, they're converted to **BSFA** pattern:

```c
#pragma parallel
for i in range(3) {
    cycle { @0,0: LWI R0, data[i]; }
    cycle { @0,0: LWI R1, data[3 + i]; }

    if (R0 > R1) @0,0 {
        cycle { @0,0: SSUB ROUT, R0, R1; }
    } else {
        cycle { @0,0: SADD ROUT, R0, R1; }
    }

    cycle { @0,0: SWD ROUT; }
}
```

**Conversion pattern:**
1. Condition check cycle: SSUB sets flags per column
2. Then path: Store result in R2
3. Else path: Store result in R3
4. BSFA select: Choose R2 or R3 based on sign flag

**Register allocation:**
- `R2`: Then branch result
- `R3`: Else branch result

> **See:** [Conditional Diff Example](../../examples/parallel/conditional-diff.md)

---

## Wave Execution

When iterations > columns, executes in **waves**:

```c
#pragma parallel
for i in range(8) {  // 8 iterations, 4 columns
    cycle { @0,0: LWI R0, data[i]; }
    cycle { @0,0: SADD ROUT, R0, R0; }
    cycle { @0,0: SWD ROUT; }
}
```

**Execution:**
```
Wave 0: i=0,1,2,3 (columns 0-3)
  Cycle 0: LWI all
  Cycle 1: SADD all
  Cycle 2: SWD all

Wave 1: i=4,5,6,7 (columns 0-3)
  Cycle 3: LWI all
  Cycle 4: SADD all
  Cycle 5: SWD all

Cycle 6: EXIT
```

**Total:** 7 cycles instead of 25 (3.6x speedup)

---

## Memory Handling

### LWI/SWI (Computed Addresses)

Addresses computed per column:
- `data[i]` → Col 0: `data[0]`, Col 1: `data[1]`, etc.
- `data[3 + i]` → Col 0: `data[3]`, Col 1: `data[4]`, etc.

### LWD/SWD (Auto-Increment)

Configure `.io_load` / `.io_store` per column:

```c
.io_load { 0, 4, 8, 12 }      // Each column reads different address
.io_store { 100, 104, 108, 112 }
```

---

## Cycle Count Comparison

| Operation | Sequential | Parallel | Speedup |
|-----------|------------|----------|---------|
| 4-element sum | 13 | 4 | 3.25x |
| 3-element conditional | 22 | 7 | 3.1x |
| 8-element (2 waves) | 25 | 7 | 3.6x |
| 16-element (4 waves) | 49 | 13 | 3.8x |

---

## Good Candidates

- Array processing (map operations)
- Element-wise arithmetic
- Independent conditionals per element
- SIMD-like operations

## Not Suitable

- Loop-carried dependencies
- Reductions (use [`#pragma reduce`](reduce.md) instead)
- Sequential algorithms

---

## Limitations

1. Maximum 4 iterations per wave (grid width)
2. Must use `@row,col:` syntax
3. If-else requires @row,col specifier
4. Registers R2, R3 reserved for BSFA
5. Wave distribution requires static coordinates (without `collapse`)

---

## Collapse Modifier for Nested Loops

The `collapse` modifier enables full parallelization of nested loops with dynamic coordinates:

```c
.data A { 1,2,3,4, 5,6,7,8, 9,10,11,12, 13,14,15,16 }
.data B { 10,20,30,40, 50,60,70,80, 90,100,110,120, 130,140,150,160 }
.data C { 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0 }

kernel "MatrixAddNested" {
    config(0xF, 0);

    // 16 iterations (4×4) collapse into 4 cycles
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

**Behavior:**
- Inner loops are expanded first, then outer iterations
- All iterations collapse by cycle position
- Result: 4 cycles with 16 instructions each (full 4×4 grid utilization)

### Without Collapse (Default)

```c
#pragma parallel
for i in range(4) {
    cycle { @0,0: SADD R0, ZERO, i; }
}
```

Uses wave-based distribution across columns (iterations distributed to columns 0-3).

### With Collapse

```c
#pragma parallel collapse
for i in range(4) {
    cycle { @i,0: SADD R0, ZERO, i; }  // Dynamic coordinate
}
```

Collapses all iterations into same cycle at their computed coordinates.

### With Collapse(N) - Partial Collapse

Use `collapse(N)` to specify how many nested loop levels to collapse:

```c
#pragma parallel collapse(2)
for i in range(4) {
    for j in range(4) {
        for k in range(4) {
            cycle { @i,j: SADD R0, ZERO, k; }
        }
    }
}
```

**Behavior:**
- `collapse(2)` collapses only the outer 2 loops (`i` and `j`)
- The innermost loop (`k`) remains sequential
- Result: 16 iterations (4×4) collapsed into parallel, each running 4 sequential `k` iterations

**Common values:**
- `collapse` or `collapse(∞)`: Collapse all levels (default)
- `collapse(1)`: Collapse only outermost loop
- `collapse(2)`: Collapse outer 2 loops

> **See:** [Dynamic Coordinates](../dynamic-coordinates.md) for more examples

---

## Navigation

- [← Unroll](unroll.md)
- [Main Index](../../README.md)
- [Next: Reduce →](reduce.md)
