# Example: Vector Sum

[← Examples Index](../README.md) | [Main Index](../../README.md)

---

A complete kernel demonstrating initialization, memory access, loops, and control flow.

## Code

<!-- expect: R1@0,1=55, memory[16]=55 -->
```c
// Constants & Aliases
.const MAX_ITER 10
.alias i_counter R0
.alias acc_val   R1

// Memory Initialization
.data 0 { 0, 0 } // data[0] -> addr 0, data[1] -> addr 4

// IO Configuration
.io_store { 0, 64 } // Col 1 will store results starting at addr 64

kernel "VectorSum" {
    config(0xF, 0);

    // Initialization
    init:
    cycle {
        // Load initial values from memory using data references
        row 0: LWI i_counter, data[0] | LWI acc_val, data[1] | _ | _;
    }

    // Main Loop
    process_loop:
    cycle {
        // Visual style for data movement
        row 0: SADD ROUT, i_counter, ZERO | SADD acc_val, acc_val, RCL | _ | _;
    }

    // Check condition
    check:
    cycle {
        // Structural style for control logic
        row 0 {
            col 0: SADD i_counter, i_counter, IMM(1);
            col 1: BLT RCL, .MAX_ITER, process_loop;
        }
    }

    // Exit
    end:
    cycle {
        @0,0: EXIT;
        @0,1: SWD R1;
    }
}
```

## Key Concepts

### 1. Constants and Aliases

```c
.const MAX_ITER 10    // Numeric constant
.alias i_counter R0   // Semantic name for R0
```

### 2. Memory Initialization

```c
.data 0 { 0, 0 }      // data[0] at addr 0, data[1] at addr 4
```

### 3. Data References

```c
LWI i_counter, data[0]  // Resolves to LWI R0, 0
LWI acc_val, data[1]    // Resolves to LWI R1, 4
```

### 4. Labels

```c
init:           // Cycle 0
process_loop:   // Cycle 1
check:          // Cycle 2
end:            // Cycle 3
```

### 5. Neighbor Communication

```c
SADD acc_val, acc_val, RCL  // Read from left neighbor (col 0)
```

### 6. Branch with Constant

```c
BLT RCL, .MAX_ITER, process_loop  // Compare with constant
```

## Execution Flow

1. **Cycle 0 (init):** Load initial values from memory
2. **Cycle 1 (process_loop):** Pass counter to col 1, accumulate
3. **Cycle 2 (check):** Increment counter, check condition
4. **Repeat** cycles 1-2 until counter >= 10
5. **Cycle 3 (end):** Store result and exit

## Expected Result

- Counter increments from 0 to 10
- Accumulator sums: 0 + 1 + 2 + ... + 9 = 45
- Result stored at address 64

---

## Navigation

- [← Examples Index](../README.md)
- [Main Index](../../README.md)
