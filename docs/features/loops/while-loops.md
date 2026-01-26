# While Loops (Runtime Iteration)

[← For Loops](for-loops.md) | [Main Index](../../README.md) | [Next: Control Flow →](../control-flow.md)

---

The `while` loop provides runtime iteration with branch instructions. Unlike `for`, which unrolls at compile time, `while` generates actual branch instructions for dynamic loops.

## Syntax

```c
while (<operand1> <operator> <operand2>) @<row>,<col> {
    // body cycles
}
```

**Supported Operators:** `==`, `!=`, `<`, `>=`, `>`, `<=`

**PE Specifier:** `@<row>,<col>` indicates where the control logic (condition check and jump) is placed.

---

## Operator Compilation

Since the ISA only supports `BEQ`, `BNE`, `BLT`, and `BGE`, the compiler automatically handles `>` and `<=`:

| Condition | Exit Branch | Logic |
|-----------|-------------|-------|
| `while (A < B)` | `BGE A, B, exit` | Exit when A >= B |
| `while (A >= B)` | `BLT A, B, exit` | Exit when A < B |
| `while (A > B)` | `BGE B, A, exit` | Exit when B >= A (swapped) |
| `while (A <= B)` | `BLT B, A, exit` | Exit when B < A (swapped) |
| `while (A == B)` | `BNE A, B, exit` | Exit when A != B |
| `while (A != B)` | `BEQ A, B, exit` | Exit when A == B |

---

## Basic Example

<!-- expect: R1@0,0=45 -->
```c
kernel "SumRange_While" {
    config(0xF, 0);

    // Initialize: counter R0=0, accumulator R1=0
    // Note: One instruction per PE per cycle
    cycle {
        @0,0: SADD R0, ZERO, IMM(0);
    }
    cycle {
        @0,0: SADD R1, ZERO, IMM(0);
    }

    // While loop: accumulate sum while R0 < 10
    while (R0 < IMM(10)) @0,0 {
        cycle {
            @0,0: SADD R1, R1, R0;      // R1 += R0
        }
        cycle {
            @0,0: SADD R0, R0, IMM(1);  // R0++
        }
    }

    cycle { @0,0: ASSERT R1, 45; }
    cycle { @0,0: EXIT; }
}
// Expected: R1 = 0+1+2+...+9 = 45
```

**Generated structure:**
```
Cycle 0: Init
Cycle 1: BGE R0, 10, exit  ← Condition check
Cycle 2: Body instruction 1
Cycle 3: Body instruction 2
Cycle 4: JUMP back to Cycle 1
... (repeats)
```

---

## Optimization Levels

The compiler provides automatic optimizations based on body configuration:

### Standard: 3 Cycles/Iteration

When body PE is the **same** as control PE:

```c
while (R0 < IMM(10)) @0,0 {
    cycle { @0,0: SADD R0, R0, IMM(1); }  // Same PE
}
```

**Structure:** Condition (1) + Body (1) + Jump (1) = **3 cycles/iter**

### Optimized: 2 Cycles/Iteration

When body uses an **adjacent PE**, the compiler:
1. Replaces condition operand with neighbor reference (RCL/RCR/RCT/RCB)
2. Fuses body + jump into single cycle

```c
while (R0 < IMM(10)) @0,0 {
    cycle { @1,0: SADD R0, R0, IMM(1); }  // Adjacent PE (col 1)
}
// Compiler uses RCR to read body PE's output
```

**Structure:** Condition (1) + Fused body+jump (1) = **2 cycles/iter**

---

## Neighbor Auto-Detection

The compiler determines neighbor reference based on first body PE position:

```
            RCT (Row - 1)
                ↑
  RCL (Col - 1) ← Control PE → RCR (Col + 1)
                ↓
            RCB (Row + 1)
```

| Body PE | Control PE | Neighbor Used |
|---------|------------|---------------|
| @0,1 | @0,0 | RCR (right col) |
| @0,0 | @0,1 | RCL (left col) |
| @1,0 | @0,0 | RCB (bottom row) |
| @0,0 | @1,0 | RCT (top row) |
| @0,2 | @0,0 | ❌ Not adjacent |

---

## Multi-Cycle Body

When body has **multiple cycles**, fusion is disabled:

```c
while (R1 > IMM(1)) @0,0 {
    cycle { @0,0: SMUL R0, R0, R1; }     // Cycle 1
    cycle { @0,0: SSUB R1, R1, IMM(1); } // Cycle 2
}
// Structure: Condition (1) + Body (2) + Jump (1) = 4 cycles/iter
```

> **See:** [Factorial Example](../../examples/loops/factorial.md) for complete multi-cycle body example.

---

## Multi-PE Body

When body has multiple instructions at different PEs in the same cycle:

```c
while (R0 <= IMM(5)) @0,3 {
    cycle {
        @0,2: SADD R0, R0, IMM(1);   // Counter
        @0,1: SADD R0, R0, RCB;      // Accumulator reads counter
    }
}
```

The neighbor reference is calculated based on the **first** `@col,row:` instruction.

> **See:** [While Optimized Example](../../examples/loops/while-optimized.md) for parallel PE patterns.

---

## Disabling Fusion: `#pragma no_fuse`

Force 3 cycles/iteration while keeping neighbor reference:

```c
#pragma no_fuse
while (R0 < IMM(10)) @0,0 {
    cycle { @1,0: SADD R0, R0, IMM(1); }
}
```

| Aspect | Without pragma | With `#pragma no_fuse` |
|--------|----------------|------------------------|
| Neighbor ref | ✓ Yes | ✓ Yes |
| Body + Jump fused | ✓ Yes | ✗ No |
| Cycles/iter | 2 | 3 |

**Use cases:**
- Debugging (easier to trace)
- Timing control (predictable structure)
- Documentation (explicit intent)

---

## Cycle Cost Summary

| Configuration | Cycles/Iter | Fusion | Neighbor |
|---------------|-------------|--------|----------|
| 1 instr, adjacent PE | 2 | ✓ | ✓ Auto |
| 1 instr, same PE | 3 | ✗ | N/A |
| 1 instr + `#pragma no_fuse` | 3 | ✗ | ✓ Auto |
| 2+ instructions, same cycle | 3 | ✗ | ✓ Auto |
| 2+ cycles in body | 3 + N | ✗ | ✓ Auto |
| Non-adjacent PEs | 3 | ✗ | N/A |

---

## While vs For Comparison

| Feature | `for` (unroll) | `#pragma no_unroll` + for | `while` |
|---------|----------------|---------------------------|---------|
| Expansion | Compile-time | Runtime | Runtime |
| Cycles/iter | 1 | 2-3 | 2-3 |
| Counter mgmt | Automatic | Automatic | Manual |
| Use case | Known, small N | Large/variable N | Dynamic conditions |

---

## Examples

- [Basic Counter](../../examples/loops/while-counter.md) - Simple while loop
- [Optimized While](../../examples/loops/while-optimized.md) - Adjacent PE optimization
- [Factorial](../../examples/loops/factorial.md) - Multi-cycle body

---

## Navigation

- [← For Loops](for-loops.md)
- [Main Index](../../README.md)
- [Next: Control Flow →](../control-flow.md)
