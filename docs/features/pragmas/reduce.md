# Pragma Reduce

[← Parallel](parallel.md) | [Main Index](../../README.md) | [Next: Stencil →](stencil.md)

---

The `#pragma reduce` directive performs **tree reduction** across all PE columns, combining values using an associative operation. The final result is stored in **column 0**.

## Syntax

```c
#pragma reduce(operation, srcReg, destReg)
```

| Parameter | Values | Description |
|-----------|--------|-------------|
| `operation` | `sum`, `max`, `min`, `and`, `or` | Reduction operation |
| `srcReg` | R0-R3, ROUT | Source register |
| `destReg` | R0-R3, ROUT | Destination register (column 0) |

---

## Supported Operations

| Operation | Instruction | Description |
|-----------|-------------|-------------|
| `sum` | SADD | Sum all values |
| `max` | BSFA pattern | Maximum value |
| `min` | BSFA pattern | Minimum value |
| `and` | LAND | Bitwise AND |
| `or` | LOR | Bitwise OR |

---

## Tree Reduction Algorithm

For a 4-column grid (log₂(4) = 2 levels):

```
Step 1: Pairwise reduction
  Col 0: R2 = R0 + Col1.R0 (via RCR)
  Col 2: R2 = R0 + Col3.R0 (via RCR)

Step 2: Relay Col 2's result through Col 1
  Col 1: R3 = Col2.R2 (via RCR)

Step 3: Final reduction
  Col 0: destReg = R2 + Col1.R3 (via RCR)
```

**Cycles:** 3 for sum/and/or, 4 for max/min (extra BSFA comparison)

---

## Example: Sum Reduction

```c
.data 0 { 10, 20, 30, 40 }

kernel "ParallelSum" {
    config(0xF, 0);

    // Load data into all columns in parallel
    #pragma parallel
    for i in range(4) {
        cycle { @0,0: LWI R0, data[i]; }
    }

    // Reduce: 10 + 20 + 30 + 40 = 100
    #pragma reduce(sum, R0, ROUT)

    // Store result from column 0
    cycle { @0,0: SWD ROUT; }
    cycle { @0,0: EXIT; }
}
```

**Compiled (6 cycles):**

```c
// Cycle 0: Parallel load
row 0: LWI R0, 0 | LWI R0, 4 | LWI R0, 8 | LWI R0, 12;

// Cycle 1: Pairwise sum
row 0: SADD R2, R0, RCR | NOP | SADD R2, R0, RCR | NOP;
// Col 0: R2 = 10 + 20 = 30
// Col 2: R2 = 30 + 40 = 70

// Cycle 2: Relay
row 0: NOP | SADD R3, RCR, ZERO | NOP | NOP;
// Col 1: R3 = 70

// Cycle 3: Final sum
row 0: SADD ROUT, R2, RCR | NOP | NOP | NOP;
// Col 0: ROUT = 30 + 70 = 100

// Cycle 4: Store
@0,0: SWD ROUT;

// Cycle 5: Exit
@0,0: EXIT;
```

**Result:** `output[0] = 100`

---

## Example: Max Reduction

```c
.data 0 { 15, 42, 8, 27 }

kernel "FindMax" {
    config(0xF, 0);

    #pragma parallel
    for i in range(4) {
        cycle { @0,0: LWI R0, data[i]; }
    }

    #pragma reduce(max, R0, ROUT)

    cycle { @0,0: SWD ROUT; }
    cycle { @0,0: EXIT; }
}
```

**Result:** `output[0] = 42`

---

## Combining with `#pragma parallel`

Typical pattern:
1. Load in parallel
2. Process in parallel
3. Reduce to single value
4. Store from column 0

```c
// Sum of 8 elements in 2 waves + reduction
#pragma parallel
for i in range(8) {
    cycle { @0,0: LWI R0, data[i]; }
    cycle { @0,0: SADD R1, R1, R0; }  // Accumulate locally
}

#pragma reduce(sum, R1, ROUT)  // Combine column totals
```

---

## Cycle Count

| Operation | Cycles |
|-----------|--------|
| sum | 3 |
| and | 3 |
| or | 3 |
| max | 4 |
| min | 4 |

---

## Registers Used

| Register | Purpose |
|----------|---------|
| R2 | Intermediate pairwise result |
| R3 | Relay register (Col 1 only) |
| srcReg | Preserved in columns 1, 2, 3 |
| destReg | Final result in **column 0 only** |

---

## Limitations

1. **Grid width fixed at 4**: Algorithm assumes 4-column grid
2. **Result only in column 0**: Other columns have intermediate values
3. **Uses R2, R3**: These registers are overwritten
4. **Row 0 only**: Reduction operates on row 0 PEs

---

## Navigation

- [← Parallel](parallel.md)
- [Main Index](../../README.md)
- [Next: Stencil →](stencil.md)
