---
title: Loops
outline: deep
---

# Loops

OpenEdge DSL supports two styles of loops: **for** (compile-time iteration) and **while** (runtime iteration with branches).

## For Loops (Compile-Time)

The `for` loop provides Python-style iteration with an accessible iteration variable that expands at compile time.

### Syntax

```c
for <var> in range(end) { ... }              // 0 to end-1
for <var> in range(start, end) { ... }       // start to end-1
for <var> in range(start, end, step) { ... } // with custom step
```

### Basic Example

```c
kernel "ForLoopTest" {
    config(0xF, 0);

    for i in range(4) {
        cycle {
            row 0: SADD R0, R0, i | _ | _ | _;
        }
    }
}
```

**Compiled Result:**
```text
Cycle 0: SADD R0, R0, 0 ...
Cycle 1: SADD R0, R0, 1 ...
Cycle 2: SADD R0, R0, 2 ...
Cycle 3: SADD R0, R0, 3 ...
```

### Range Variants

```c
// Start and end
for i in range(2, 6) {
    cycle { row 0: LWI R0, i | _ | _ | _; }    // i = 2, 3, 4, 5
}

// With step
for i in range(0, 10, 2) {
    cycle { row 0: SADD R0, ZERO, i | _ | _ | _; }  // i = 0, 2, 4, 6, 8
}

// Descending
for i in range(3, 0, -1) {
    cycle { row 0: SADD R0, ZERO, i | _ | _ | _; }  // i = 3, 2, 1
}
```

### Data References with Arithmetic

```c
.data 0 { 10, 20, 5, 3, 15, 10 }

kernel "ConditionalDiff" {
    config(0xF, 0);

    for i in range(3) {
        cycle { @0,0: LWI R0, data[i]; }       // R0 = a[i]
        cycle { @0,0: LWI R1, data[3 + i]; }   // R1 = b[i]
        cycle { @0,0: SSUB R2, R0, R1; }
        cycle { @0,0: SWD R2; }
    }

    cycle { @0,0: EXIT; }
}
```

**Supported arithmetic:** `data[i]`, `data[3 + i]`, `data[i * 2]`, `data[N - i]`

---

## While Loops (Runtime)

The `while` loop generates actual branch instructions for dynamic iteration.

### Syntax

```c
while (<operand1> <operator> <operand2>) @<row>,<col> {
    // body cycles
}
```

**Supported Operators:** `==`, `!=`, `<`, `>=`, `>`, `<=`

The `@<row>,<col>` specifier indicates where the control logic is placed.

### Operator → Branch Mapping

| Condition | Exit Branch | Logic |
|-----------|-------------|-------|
| `while (A < B)` | `BGE A, B, exit` | Exit when A >= B |
| `while (A >= B)` | `BLT A, B, exit` | Exit when A < B |
| `while (A > B)` | `BGE B, A, exit` | Swapped operands |
| `while (A == B)` | `BNE A, B, exit` | Exit when A != B |

### Basic Example

```c
kernel "SumRange_While" {
    config(0xF, 0);

    cycle { @0,0: SADD R0, ZERO, IMM(0); }
    cycle { @0,0: SADD R1, ZERO, IMM(0); }

    while (R0 < IMM(10)) @0,0 {
        cycle { @0,0: SADD R1, R1, R0; }     // R1 += R0
        cycle { @0,0: SADD R0, R0, IMM(1); } // R0++
    }

    cycle { @0,0: ASSERT R1, 45; }
    cycle { @0,0: EXIT; }
}
```

### Optimization Levels

| Configuration | Cycles/Iter | Fusion | Neighbor |
|---------------|-------------|--------|----------|
| 1 instr, adjacent PE | 2 | ✓ | ✓ Auto |
| 1 instr, same PE | 3 | ✗ | N/A |
| 1 instr + `#pragma no_fuse` | 3 | ✗ | ✓ Auto |
| 2+ cycles in body | 3 + N | ✗ | ✓ Auto |

---

## For vs While Comparison

| Feature | `for` (unroll) | `while` |
|---------|----------------|---------|
| Expansion | Compile-time | Runtime |
| Cycles/iter | 1 | 2-3 |
| Counter | Automatic (IMM) | Manual |
| Use case | Known, small N | Dynamic conditions |
