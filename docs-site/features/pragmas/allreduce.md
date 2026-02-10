# Pragma Allreduce

[← Reduce](reduce.md) | [Main Index](../../README.md) | [Next: Transpose →](transpose.md)

---

The `#pragma allreduce` directive combines **reduce + broadcast** in a single operation. After execution, **all PEs** have the reduction result (unlike `#pragma reduce`, where only PE(0,0) gets the final value).

## Syntax

```c
#pragma allreduce(operation, destReg, srcReg)
#pragma allreduce(operation, destReg, srcReg, axis=col)
```

| Parameter | Values | Description |
|-----------|--------|-------------|
| `operation` | `sum`, `max`, `min`, `and`, `or`, `xor`, `mul` | Reduction operation |
| `destReg` | R0-R3, ROUT | Destination register (all PEs) |
| `srcReg` | R0-R3, ROUT | Source register |
| `axis` | `row` (default), `col` | Reduction direction |

---

## Before vs After

### Without allreduce (manual)

```c
#pragma reduce(sum, R1, R0)                      // Only PE(0,0) has the sum
#pragma broadcast(value=R1, from=@0,0, to=row)   // Now all PEs have it
```

### With allreduce

```c
#pragma allreduce(sum, R1, R0)  // All PEs get the sum in R1
```

---

## Example: Global Sum

```c
kernel "AllreduceSum" {
    config(0xF, 0);

    cycle {
        @0,0: SADD R0, ZERO, IMM(10);
        @0,1: SADD R0, ZERO, IMM(20);
        @0,2: SADD R0, ZERO, IMM(30);
        @0,3: SADD R0, ZERO, IMM(40);
    }

    // All PEs get R1 = 100
    #pragma allreduce(sum, R1, R0)

    cycle { @0,0: EXIT; }
}
```

**Result:** All PEs have `R1 = 100`

---

## Algorithm

Allreduce is composed of two phases:

1. **Reduce phase**: Tree reduction (same as `#pragma reduce`) — result in PE(0,0)
2. **Broadcast phase**: Chain broadcast from PE(0,0) to all PEs

---

## Cycle Count

| Operation | Horizontal (row) | Vertical (col) |
|-----------|------------------|----------------|
| sum/and/or/xor/mul | 8 | 8 |
| max/min | 10 | 10 |

(4 cycles reduce + 4 cycles broadcast)

---

## Registers Used

| Register | Purpose |
|----------|---------|
| R2 | Intermediate pairwise result (reduce phase) |
| R3 | Relay register (reduce phase) |
| destReg | Final result in **all PEs** |

---

## Limitations

1. **Grid size fixed at 4**: Algorithm assumes 4-column/4-row grid
2. **Uses R2, R3**: These registers are overwritten during reduction
3. **Row 0 only** (horizontal): Operates on row 0 PEs

---

## Navigation

- [← Reduce](reduce.md)
- [Main Index](../../README.md)
- [Next: Transpose →](transpose.md)
