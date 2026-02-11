# Example: Control Flow

[← Examples Index](../README.md) | [Main Index](../../README.md)

---

Demonstrates forward and backward jumps with label resolution.

## Code

<!-- expect: R0@0,0=10 -->
```c
kernel "FlowControl" {
    config(0xF, 0);

    // Cycle 0: Label 'loop_start'
    loop_start:
    cycle {
        // Forward Branch: Jump to 'cleanup' if R0 == 10
        // Compiler resolves 'cleanup' to Cycle 2
        row 0: BEQ R0, IMM(10), cleanup | _ | _ | _;
    }

    // Cycle 1: Body
    cycle {
        row 0: SADD R0, R0, IMM(1) | _ | _ | _;
        // Backward Branch: Unconditional jump to 'loop_start' (Cycle 0)
        row 1: JUMP ZERO, ZERO, loop_start | _ | _ | _;
    }

    // Cycle 2: Label 'cleanup'
    cleanup:
    cycle {
        @0,0: EXIT;
    }
}
```

## Label Resolution

| Label | Resolved Cycle |
|-------|----------------|
| `loop_start` | 0 |
| `cleanup` | 2 |

## Compiled Output

```
Cycle 0, Row 0: BEQ R0, 10, 2 | NOP | NOP | NOP
Cycle 1, Row 0: SADD R0, R0, 1 | NOP | NOP | NOP
Cycle 1, Row 1: JUMP ZERO, ZERO, 0 | NOP | NOP | NOP
Cycle 2, Row 0: EXIT | NOP | NOP | NOP
```

## Execution Flow

```
Start → Cycle 0 (R0=0, 0≠10) → Cycle 1 (R0=1) → Jump to Cycle 0
     → Cycle 0 (R0=1, 1≠10) → Cycle 1 (R0=2) → Jump to Cycle 0
     ...
     → Cycle 0 (R0=10, 10==10) → Branch to Cycle 2
     → Cycle 2: EXIT
```

## Key Concepts

### Forward Jump

```c
BEQ R0, IMM(10), cleanup  // cleanup is ahead (Cycle 2)
```

The compiler resolves `cleanup` to cycle number 2 during Pass 1.

### Backward Jump

```c
JUMP ZERO, ZERO, loop_start  // loop_start is behind (Cycle 0)
```

Uses `ZERO, ZERO` as dummy operands for unconditional jump.

### Label Placement

Labels are placed **before** the cycle block:

```c
my_label:     // ← Label applies to THIS cycle
cycle {
    // ...
}
```

---

## Vector Addition Example

A more practical example using IO configuration:

```c
.data 0 { 1, 2, 3, 4 }       // Vector A
.data   { 10, 20, 30, 40 }   // Vector B (auto at addr 16)

.io_load  { 0, 16, 0, 0 }    // Col 0 reads A, Col 1 reads B
.io_store { 0, 32, 0, 0 }    // Col 1 writes result

.const ITERATIONS 4

kernel "VectorAddIO" {
    config(0x3, 0);  // Columns 0 and 1 active

    loop:
    cycle {
        row 0: LWD R0 | LWD R1 | _ | _;
    }

    cycle {
        row 0: _ | SADD ROUT, RCL, R1 | _ | _;
    }

    cycle {
        row 0 {
            col 1: SWD ROUT;
            col 0: SADD R3, R3, IMM(1);
        }
    }

    cycle {
        row 0 {
             col 0: BLT R3, .ITERATIONS, loop;
        }
    }

    end:
    cycle {
        @0,0: EXIT;
    }
}
```

**Result:** C[i] = A[i] + B[i] stored at addresses 32, 36, 40, 44

---

## Navigation

- [← Examples Index](../README.md)
- [Main Index](../../README.md)
