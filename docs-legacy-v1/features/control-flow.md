# Structured Control Flow (If-Else)

[← While Loops](loops/while-loops.md) | [Main Index](../README.md) | [Next: Assertions →](assertions.md)

---

The `if` and `else` keywords provide a high-level abstraction for control flow, automatically managing labels and branch instructions.

## Syntax

```c
if (<operand1> <operator> <operand2>) @<row>,<col> {
    // then block
} else {
    // else block
}
```

**Supported Operators:** `==`, `!=`, `<`, `>=`, `>`, `<=`

---

## Compilation Logic

The compiler inverts the condition to jump over the "then" block if the condition is false. The ISA only supports `BEQ`, `BNE`, `BLT`, and `BGE`, so `>` and `<=` operators require operand swapping.

| High-Level Condition | Generated Branch | Logic |
|:---------------------|:-----------------|:------|
| `if (A == B)` | `BNE A, B, <else_label>` | Skip if not equal |
| `if (A != B)` | `BEQ A, B, <else_label>` | Skip if equal |
| `if (A < B)` | `BGE A, B, <else_label>` | Skip if greater/equal |
| `if (A >= B)` | `BLT A, B, <else_label>` | Skip if less |
| `if (A > B)` | `BGE B, A, <else_label>` | Skip if B >= A (swapped) |
| `if (A <= B)` | `BLT B, A, <else_label>` | Skip if B < A (swapped) |

---

## Basic Example

```c
kernel "IfElseTest" {
    config(0xF, 0);

    if (R0 < IMM(10)) @0,0 {
        cycle {
            row 0: SADD R0, R0, IMM(1) | _ | _ | _;
        }
    } else {
        cycle {
            row 0: SADD R0, R0, IMM(2) | _ | _ | _;
        }
    }
}
```

**Compiles to:**

```c
// Generated Condition Cycle
cycle {
    // Inverted logic: Jump to else if R0 >= 10
    @0,0: BGE R0, IMM(10), _else_label_0;
}

// Then Block
cycle {
    row 0: SADD R0, R0, IMM(1) | _ | _ | _;
}

// Jump over Else
cycle {
    @0,0: JUMP _end_label_0, ZERO;
}

// Else Label
_else_label_0:

// Else Block
cycle {
    row 0: SADD R0, R0, IMM(2) | _ | _ | _;
}

// End Label
_end_label_0:
```

---

## If-Else with For Loop

Common pattern for translating C ternary operators:

```c
// C equivalent:
// for (int i = 0; i < n; i++) {
//     c[i] = (a[i] > b[i]) ? (a[i] - b[i]) : (a[i] + b[i]);
// }

.data 0 { 5, 10, 3, 2, 20, 3 }   // a[0..2], b[0..2]
.io_store { 100, 0, 0, 0 }

kernel "ConditionalDiff_IfElse" {
    config(0xF, 0);

    for i in range(3) {
        cycle { @0,0: LWI R0, data[i]; }       // R0 = a[i]
        cycle { @0,0: LWI R1, data[3 + i]; }   // R1 = b[i]

        if (R0 > R1) @0,0 {
            cycle { @0,0: SSUB ROUT, R0, R1; } // diff = a - b
        } else {
            cycle { @0,0: SADD ROUT, R0, R1; } // sum = a + b
        }

        cycle { @0,0: SWD ROUT; }              // Store result
    }

    cycle { @0,0: EXIT; }
}
```

**Execution trace:**

| i | a[i] | b[i] | Condition | Result |
|---|------|------|-----------|--------|
| 0 | 5 | 2 | 5 > 2 ✓ | 5 - 2 = 3 |
| 1 | 10 | 20 | 10 > 20 ✗ | 10 + 20 = 30 |
| 2 | 3 | 3 | 3 > 3 ✗ | 3 + 3 = 6 |

> **See also:** [Conditional Diff Example](../examples/parallel/conditional-diff.md) for a parallel version using `#pragma parallel`.

---

## If Without Else

The else block is optional:

```c
if (R0 == ZERO) @0,0 {
    cycle { @0,0: SADD R1, R1, IMM(1); }
}
// Continues here if condition is false
```

---

## Navigation

- [← While Loops](loops/while-loops.md)
- [Main Index](../README.md)
- [Next: Assertions →](assertions.md)
