# For Loops (Compile-Time Iteration)

[← Functions](../functions.md) | [Main Index](../../README.md) | [Next: While Loops →](while-loops.md)

---

The `for` loop provides Python-style iteration with an accessible iteration variable that expands at compile time.

## Syntax

```c
for <var> in range(end) { ... }           // 0 to end-1
for <var> in range(start, end) { ... }    // start to end-1
for <var> in range(start, end, step) { ... }  // with custom step
```

**Variable Expansion:** The iteration variable is expanded at compile time. When used in an instruction, it becomes `IMM(value)`.

---

## Basic Example

```c
kernel "ForLoopTest" {
    config(0xF, 0);

    // Generates 4 cycles with i = 0, 1, 2, 3
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
Cycle 4 (Implicit Exit): EXIT ...
```

---

## Range Variants

### Range with Start and End

```c
for i in range(2, 6) {
    cycle {
        row 0: LWI R0, i | _ | _ | _;  // i = 2, 3, 4, 5
    }
}
```

### Range with Step

```c
for i in range(0, 10, 2) {
    cycle {
        row 0: SADD R0, ZERO, i | _ | _ | _;  // i = 0, 2, 4, 6, 8
    }
}
```

### Descending Loop

```c
for i in range(3, 0, -1) {
    cycle {
        row 0: SADD R0, ZERO, i | _ | _ | _;  // i = 3, 2, 1
    }
}
```

---

## Ignoring the Iteration Variable

Use `_` if you don't need the variable:

```c
for _ in range(4) {
    cycle {
        row 0: SADD R0, R0, IMM(1) | _ | _ | _;
    }
}
```

---

## Data References with Arithmetic

The iteration variable can be used in `data[]` index arithmetic expressions:

```c
// Process two arrays: a[0..2] and b[0..2] = a[3..5]
.data 0 { 10, 20, 5, 3, 15, 10 }

kernel "ConditionalDiff" {
    config(0xF, 0);

    for i in range(3) {
        cycle { @0,0: LWI R0, data[i]; }       // R0 = a[i]
        cycle { @0,0: LWI R1, data[3 + i]; }   // R1 = b[i] (offset by 3)
        cycle { @0,0: SSUB R2, R0, R1; }       // R2 = a[i] - b[i]
        cycle { @0,0: SWD R2; }
    }

    cycle { @0,0: EXIT; }
}
```

**Supported arithmetic:**
- `data[i]` - Direct index
- `data[3 + i]` - Addition
- `data[i * 2]` - Multiplication
- `data[N - i]` - Subtraction
- Operator precedence: `*` and `/` before `+` and `-`

---

## With Functions

The iteration variable is substituted before function expansion:

```c
function INIT_REG(idx) {
    row 0: LWI R0, idx | _ | _ | _;
}

kernel "ForWithFunction" {
    config(0xF, 0);

    for i in range(4) {
        cycle {
            INIT_REG(i);  // i is substituted first
        }
    }
}
```

---

## Controlling Unrolling

By default, for loops are fully unrolled at compile time. See [Pragma Unroll](../pragmas/unroll.md) for:

- `#pragma unroll` - Force full unrolling (default)
- `#pragma unroll(N)` - Partial unrolling
- `#pragma no_unroll` - Generate runtime loop with branches

---

## For vs While

| Feature | `for` | `while` |
|---------|-------|---------|
| Expansion | Compile-time | Runtime |
| Cycles/iter | 1 | 2-3 |
| Counter | Automatic (IMM) | Manual |
| Use case | Known, small N | Dynamic conditions |

> For runtime loops, see [While Loops](while-loops.md) or [#pragma no_unroll](../pragmas/unroll.md).

---

## Navigation

- [← Functions](../functions.md)
- [Main Index](../../README.md)
- [Next: While Loops →](while-loops.md)
