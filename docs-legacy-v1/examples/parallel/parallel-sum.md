# Example: Parallel Sum

[← Examples Index](../README.md) | [Main Index](../../README.md)

---

Basic SIMD-like operation using `#pragma parallel`.

## Simple Parallel Sum

<!-- expect: memory[25]=2, memory[26]=4, memory[27]=6, memory[28]=8 -->
```c
.data 0 { 1, 2, 3, 4 }
.io_store { 100, 104, 108, 112 }

kernel "ParallelSum" {
    config(0xF, 0);

    #pragma parallel
    for i in range(4) {
        cycle { @0,0: LWI R0, data[i]; }      // Load a[i]
        cycle { @0,0: SADD ROUT, R0, R0; }    // result = a[i] * 2
        cycle { @0,0: SWD ROUT; }             // Store result
    }

    cycle { @0,0: EXIT; }
}
```

## Compiled Output

```c
// Cycle 0: Load all elements in parallel
cycle {
    @0,0: LWI R0, data[0];   // R0 = 1
    @0,1: LWI R0, data[1];   // R0 = 2
    @0,2: LWI R0, data[2];   // R0 = 3
    @0,3: LWI R0, data[3];   // R0 = 4
}

// Cycle 1: Compute all in parallel
cycle {
    @0,0: SADD ROUT, R0, R0;  // ROUT = 2
    @0,1: SADD ROUT, R0, R0;  // ROUT = 4
    @0,2: SADD ROUT, R0, R0;  // ROUT = 6
    @0,3: SADD ROUT, R0, R0;  // ROUT = 8
}

// Cycle 2: Store all in parallel
cycle {
    @0,0: SWD ROUT;
    @0,1: SWD ROUT;
    @0,2: SWD ROUT;
    @0,3: SWD ROUT;
}

// Cycle 3: Exit
cycle { @0,0: EXIT; }
```

## Performance

| Metric | Sequential | Parallel |
|--------|------------|----------|
| Cycles | 13 | 4 |
| Speedup | - | 3.25x |

## Wave Execution (8 elements)

```c
.data 0 { 1, 2, 3, 4, 5, 6, 7, 8 }
.io_store { 100, 104, 108, 112 }

#pragma parallel
for i in range(8) {
    cycle { @0,0: LWI R0, data[i]; }
    cycle { @0,0: SADD ROUT, R0, R0; }
    cycle { @0,0: SWD ROUT; }
}
```

**Execution:**
```
Wave 0 (i=0,1,2,3):
  Cycle 0: LWI all columns
  Cycle 1: SADD all columns
  Cycle 2: SWD all columns

Wave 1 (i=4,5,6,7):
  Cycle 3: LWI all columns
  Cycle 4: SADD all columns
  Cycle 5: SWD all columns

Cycle 6: EXIT
```

**Speedup:** 3.6x (25 → 7 cycles)

## With Reduction

Combine parallel loading with reduction:

```c
.data 0 { 10, 20, 30, 40 }

kernel "ParallelThenReduce" {
    config(0xF, 0);

    // Load in parallel
    #pragma parallel
    for i in range(4) {
        cycle { @0,0: LWI R0, data[i]; }
    }

    // Reduce sum: 10+20+30+40 = 100
    #pragma reduce(sum, R0, ROUT)

    // Store result from column 0
    cycle { @0,0: SWD ROUT; }
    cycle { @0,0: EXIT; }
}
```

---

## Navigation

- [← Examples Index](../README.md)
- [Main Index](../../README.md)
