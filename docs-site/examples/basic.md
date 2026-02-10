---
title: Basic Kernels
outline: deep
---

# Basic Kernels

Fundamental OpenEdge DSL examples demonstrating data loading, computation, and control flow.

## Vector Sum

Demonstrates memory initialization, data references, labels, neighbor communication, and branching.

```c
.const MAX_ITER 10
.alias i_counter R0
.alias acc_val   R1

.data 0 { 0, 0 }
.io_store { 0, 64 }

kernel "VectorSum" {
    config(0xF, 0);

    init:
    cycle {
        row 0: LWI i_counter, data[0] | LWI acc_val, data[1] | _ | _;
    }

    process_loop:
    cycle {
        row 0: SADD ROUT, i_counter, ZERO | SADD acc_val, acc_val, RCL | _ | _;
    }

    check:
    cycle {
        row 0 {
            col 0: SADD i_counter, i_counter, IMM(1);
            col 1: BLT RCL, .MAX_ITER, process_loop;
        }
    }

    end:
    cycle {
        @0,0: EXIT;
        @0,1: SWD R1;
    }
}
```

### Key Concepts

| Concept | Example |
|---------|---------|
| Constants | `.const MAX_ITER 10` |
| Aliases | `.alias i_counter R0` |
| Data Refs | `LWI R0, data[0]` → `LWI R0, 0` |
| Neighbor Read | `SADD acc_val, acc_val, RCL` |
| Branch | `BLT RCL, .MAX_ITER, loop` |

---

## Control Flow

Forward and backward jumps with label resolution:

```c
kernel "FlowControl" {
    config(0xF, 0);

    loop_start:
    cycle {
        row 0: BEQ R0, IMM(10), cleanup | _ | _ | _;
    }

    cycle {
        row 0: SADD R0, R0, IMM(1) | _ | _ | _;
        row 1: JUMP ZERO, ZERO, loop_start | _ | _ | _;
    }

    cleanup:
    cycle {
        @0,0: EXIT;
    }
}
```

| Label | Resolved Cycle |
|-------|----------------|
| `loop_start` | 0 |
| `cleanup` | 2 |

---

## Vector Addition with IO

```c
.data 0 { 1, 2, 3, 4 }
.data   { 10, 20, 30, 40 }

.io_load  { 0, 16, 0, 0 }
.io_store { 0, 32, 0, 0 }

.const ITERATIONS 4

kernel "VectorAddIO" {
    config(0x3, 0);

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
