# Pragma Reduce

[← Parallel](parallel.md) | [Main Index](../../README.md) | [Next: Stencil →](stencil.md)

---

The `#pragma reduce` directive performs **tree reduction** across all PE columns (or rows), combining values using an associative operation. The final result is stored in **column 0** (or **row 0** for vertical reduce).

## Syntax

```c
#pragma reduce(operation, destReg, srcReg)
#pragma reduce(operation, destReg, srcReg, axis=col)
```

| Parameter | Values | Description |
|-----------|--------|-------------|
| `operation` | `sum`, `max`, `min`, `and`, `or`, `xor`, `mul` | Reduction operation |
| `destReg` | R0-R3, ROUT | Destination register |
| `srcReg` | R0-R3, ROUT | Source register |
| `axis` | `row` (default), `col` | Reduction direction |

---

## Supported Operations

| Operation | Instruction | Description |
|-----------|-------------|-------------|
| `sum` | SADD | Sum all values |
| `max` | BSFA pattern | Maximum value |
| `min` | BSFA pattern | Minimum value |
| `and` | LAND | Bitwise AND |
| `or` | LOR | Bitwise OR |
| `xor` | LXOR | Bitwise XOR |
| `mul` | SMUL | Product |

---

## Tree Reduction Algorithm

For a 4-column grid (log₂(4) = 2 levels):

```
Step 0: Broadcast srcReg → ROUT (all PEs)

Step 1: Pairwise reduction
  Col 0: R2 = srcReg + Col1.srcReg (via RCR)
  Col 2: R2 = srcReg + Col3.srcReg (via RCR)

Step 2: Relay Col 2's result through Col 1
  Col 1: R3 = Col2.R2 (via RCR)

Step 3: Final reduction
  Col 0: destReg = R2 + Col1.R3 (via RCR)
```

**Cycles:** 4 for sum/and/or, 6 for max/min (SSUB+BSFA comparison)

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
    #pragma reduce(sum, ROUT, R0)

    // Store result from column 0
    cycle { @0,0: SWD ROUT; }
    cycle { @0,0: EXIT; }
}
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

    #pragma reduce(max, ROUT, R0)

    cycle { @0,0: SWD ROUT; }
    cycle { @0,0: EXIT; }
}
```

**Result:** `output[0] = 42`

---

## Vertical Reduce (`axis=col`)

By default, reduce operates across **columns** in row 0. With `axis=col`, it reduces across **rows** in column 0:

```c
kernel "VerticalSum" {
    config(0xF, 0);

    // Load values into column 0, each row
    cycle {
        @0,0: SADD R0, ZERO, IMM(10);
        @1,0: SADD R0, ZERO, IMM(20);
        @2,0: SADD R0, ZERO, IMM(30);
        @3,0: SADD R0, ZERO, IMM(40);
    }

    // Vertical reduce: 10 + 20 + 30 + 40 = 100
    #pragma reduce(sum, R1, R0, axis=col)

    // Result in R1 at PE(0,0)
    cycle { @0,0: EXIT; }
}
```

The vertical reduce uses `RCB` (bottom neighbor) instead of `RCR` (right neighbor) for PE-to-PE communication.

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

#pragma reduce(sum, ROUT, R1)  // Combine column totals
```

---

## Cycle Count

| Operation | Horizontal (row) | Vertical (col) |
|-----------|------------------|----------------|
| sum | 4 | 4 |
| and | 4 | 4 |
| or | 4 | 4 |
| xor | 4 | 4 |
| mul | 4 | 4 |
| max | 6 | 6 |
| min | 6 | 6 |

---

## Registers Used

| Register | Purpose |
|----------|---------|
| R2 | Intermediate pairwise result |
| R3 | Relay register |
| srcReg | Preserved in non-participating PEs |
| destReg | Final result in **column 0** (or **row 0**) |

---

## Limitations

1. **Grid size fixed at 4**: Algorithm assumes 4-column/4-row grid
2. **Result only in PE(0,0) column/row**: Other PEs have intermediate values
3. **Uses R2, R3**: These registers are overwritten
4. **Row 0 only** (horizontal): Reduction operates on row 0 PEs
5. **Column 0 only** (vertical): Reduction operates on column 0 PEs

---

## Navigation

- [← Parallel](parallel.md)
- [Main Index](../../README.md)
- [Next: Stencil →](stencil.md)
