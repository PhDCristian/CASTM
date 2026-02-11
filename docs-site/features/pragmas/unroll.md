# Pragma Unroll

[← Pragmas Index](README.md) | [Main Index](../../README.md) | [Next: Parallel →](parallel.md)

---

Control how for loops are expanded by the compiler.

## Directives

| Pragma | Effect |
|--------|--------|
| `#pragma unroll` | Full compile-time unrolling (default) |
| `#pragma unroll(N)` | Unroll first N iterations only |
| `#pragma no_unroll` | Generate runtime loop with branches |

---

## `#pragma unroll` - Full Unrolling

Forces complete compile-time unrolling. This is the **default behavior**.

```c
#pragma unroll
for i in range(4) {
    cycle {
        row 0: SADD R0, R0, i | _ | _ | _;
    }
}
```

**Compiled:** 4 cycles with i = 0, 1, 2, 3 (no branches).

---

## `#pragma unroll(N)` - Partial Unrolling

Unrolls only the first N iterations. Useful for large loops.

```c
#pragma unroll(4)
for i in range(16) {
    cycle {
        row 0: SADD R0, R0, i | _ | _ | _;
    }
}
```

**Compiled:** 4 cycles (i = 0, 1, 2, 3). Remaining iterations truncated.

**Note:** Partial unrolling truncates extra iterations.

---

## `#pragma no_unroll` - Runtime Loop

Generates a runtime loop with branch instructions. The iteration variable **must be a register** (R0-R3).

### Syntax

```c
#pragma no_unroll
for <register> in range(...) [@row,col] { ... }
```

The optional `@row,col` specifies where control logic is placed (default: `@0,0`).

### Optimization Levels

#### Standard: 3 Cycles/Iteration

When body uses same PE as control:

```c
#pragma no_unroll
for R0 in range(0, 10) @1,0 {
    cycle {
        @1,0: SADD R1, R1, R0;  // Same PE as control
    }
}
```

**Structure:** Condition + Body + Fused(inc+jump) = 3 cycles/iter

#### Aggressive: 2 Cycles/Iteration

When body uses **adjacent PE** with single instruction:

```c
#pragma no_unroll
for R0 in range(0, 10) @1,0 {
    cycle {
        @0,0: SADD R1, R1, R0;  // Adjacent PE (uses RCR)
    }
}
```

**Requirements:**
- Body has exactly 1 cycle
- Body has exactly 1 instruction
- Body PE is adjacent to control PE
- Uses `@row,col:` syntax

**Structure:** Condition (with relay) + Fused(body+inc+jump) = 2 cycles/iter

---

## Example: Sum 0 to 9

### Aggressive Optimization (2 cycles/iter)

```c
kernel "SumRange_Aggressive" {
    config(0xF, 0);

    cycle {
        @1,0: SADD R0, ZERO, IMM(0);  // Counter at control PE
        @0,0: SADD R1, ZERO, IMM(0);  // Accumulator at body PE
    }

    #pragma no_unroll
    for R0 in range(0, 10) @1,0 {
        cycle {
            @0,0: SADD R1, R1, R0;  // R0 → RCR
        }
    }

    cycle {
        @1,0: EXIT;
    }
}
// Total: ~23 cycles
// Note: Result should be R1=45 at @0,0 (sum of 0-9)
```

### Standard Optimization (3 cycles/iter)

<!-- expect: R1@1,0=45 -->
```c
kernel "SumRange_Standard" {
    config(0xF, 0);

    // Note: One instruction per PE per cycle
    cycle {
        @1,0: SADD R0, ZERO, IMM(0);
    }
    cycle {
        @1,0: SADD R1, ZERO, IMM(0);  // Same PE
    }

    #pragma no_unroll
    for R0 in range(0, 10) @1,0 {
        cycle {
            @1,0: SADD R1, R1, R0;  // Same PE → no fusion
        }
    }

    cycle { @1,0: ASSERT R1, 45; }
    cycle { @1,0: EXIT; }
}
// Total: ~34 cycles
```

---

## Performance Comparison

| Method | Cycles (N=10) | Notes |
|--------|---------------|-------|
| Compile-time unroll | 10 | Best for small N |
| `no_unroll` aggressive | ~23 | Adjacent PEs |
| `no_unroll` standard | ~33 | Same PE |

---

## When to Use

| Pragma | Use Case |
|--------|----------|
| `unroll` (default) | Small, known iteration count |
| `unroll(N)` | Test subset of large loop |
| `no_unroll` | Large/variable N, dynamic conditions |

---

## Constants in Range Arguments

You can use constants defined with `.const` in range arguments:

<!-- expect: R0@0,0=6 -->
```c
.const ITERATIONS 4

kernel "ConstantRange" {
    config(0xF, 0);

    #pragma unroll
    for i in range(ITERATIONS) {
        cycle {
            row 0: SADD R0, R0, i | _ | _ | _;
        }
    }

    cycle { row 0: ASSERT R0, 6; }  // 0+1+2+3 = 6
    cycle { row 0: EXIT; }
}
```

**Supported in range arguments:**
- Numbers: `range(4)`, `range(0, 10)`, `range(0, 10, 2)`
- Negative numbers: `range(-5, 5)`
- Constants: `range(N)`, `range(0, COUNT)`
- Array properties: `range(data.len())`

---

## Combining Pragmas

```c
kernel "NestedLoops" {
    config(0xF, 0);

    #pragma unroll
    for outer in range(4) {
        #pragma no_unroll
        for R2 in range(16) {
            cycle {
                row 0: SADD R1, R1, outer | _ | _ | _;
                row 1: SADD R0, R0, R2 | _ | _ | _;
            }
        }
    }
}
// 4 complete runtime loops (one per outer iteration)
```

---

## Navigation

- [← Pragmas Index](README.md)
- [Main Index](../../README.md)
- [Next: Parallel →](parallel.md)
