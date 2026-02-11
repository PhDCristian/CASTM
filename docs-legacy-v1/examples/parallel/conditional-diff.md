# Example: Conditional Diff

[← Examples Index](../README.md) | [Main Index](../../README.md)

---

If-else with BSFA conversion for parallel execution.

## Problem

Compute: `c[i] = (a[i] > b[i]) ? (a[i] - b[i]) : (a[i] + b[i])`

Each column evaluates its own condition independently.

## Code

```c
.data values { 5, 10, 3, 2, 20, 3 }   // a[0..2], b[0..2]
.io_store { 100, 0, 0, 0 }

kernel "ConditionalDiff_Parallel" {
    config(0xF, 0);

    #pragma parallel
    for i in range(3) {
        cycle { @0,0: LWI R0, values[i]; }       // R0 = a[i]
        cycle { @0,0: LWI R1, values[3 + i]; }   // R1 = b[i]

        if (R0 > R1) @0,0 {
            cycle { @0,0: SSUB ROUT, R0, R1; } // diff
        } else {
            cycle { @0,0: SADD ROUT, R0, R1; } // sum
        }

        cycle { @0,0: SWD ROUT; }
    }

    cycle { @0,0: EXIT; }
}
```

## Compiled Output

```c
// Cycle 0: Load a[i]
@0,0: LWI R0, 0;   // a[0] = 5
@0,1: LWI R0, 4;   // a[1] = 10
@0,2: LWI R0, 8;   // a[2] = 3

// Cycle 1: Load b[i]
@0,0: LWI R1, 12;  // b[0] = 2
@0,1: LWI R1, 16;  // b[1] = 20
@0,2: LWI R1, 20;  // b[2] = 3

// Cycle 2: Condition check (SSUB sets sign flag)
@0,0: SSUB R1, R0, R1;  // 5-2=3 (S=0)
@0,1: SSUB R1, R0, R1;  // 10-20=-10 (S=1)
@0,2: SSUB R1, R0, R1;  // 3-3=0 (S=0)

// Cycle 3: Then path → R2
@0,0: SSUB R2, R0, R1;  // R2 = 3
@0,1: SSUB R2, R0, R1;  // R2 = -10
@0,2: SSUB R2, R0, R1;  // R2 = 0

// Cycle 4: Else path → R3
@0,0: SADD R3, R0, R1;  // R3 = 7
@0,1: SADD R3, R0, R1;  // R3 = 30
@0,2: SADD R3, R0, R1;  // R3 = 6

// Cycle 5: BSFA select (S=1 → R3, S=0 → R2)
@0,0: BSFA ROUT, R3, R2, SELF;  // S=0 → R2 = 3
@0,1: BSFA ROUT, R3, R2, SELF;  // S=1 → R3 = 30
@0,2: BSFA ROUT, R3, R2, SELF;  // S=0 → R2 = 0

// Cycle 6: Store
@0,0: SWD ROUT;
@0,1: SWD ROUT;
@0,2: SWD ROUT;

// Cycle 7: Exit
@0,0: EXIT;
```

## BSFA Conversion Pattern

| Step | Purpose | Register |
|------|---------|----------|
| 1 | Condition check | Sets S flag |
| 2 | Then path | R2 |
| 3 | Else path | R3 |
| 4 | BSFA select | S=1→R3, S=0→R2 |

## Execution Trace

| i | a[i] | b[i] | a>b? | S flag | Result |
|---|------|------|------|--------|--------|
| 0 | 5 | 2 | ✓ | 0 | 5-2=3 |
| 1 | 10 | 20 | ✗ | 1 | 10+20=30 |
| 2 | 3 | 3 | ✗ | 0 | 3+3=6* |

*Note: 3=3 gives S=0 (not negative), so takes "then" path (R2=0). Semantic issue: equality should go to else.

## Performance

| Metric | Sequential | Parallel |
|--------|------------|----------|
| Cycles | 22 | 8 |
| Speedup | - | 2.75x |

---

## Navigation

- [← Examples Index](../README.md)
- [Main Index](../../README.md)
