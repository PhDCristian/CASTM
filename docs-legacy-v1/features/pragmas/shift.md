# Pragma Shift

[← Rotate](rotate.md) | [Main Index](../../README.md)

---

The `#pragma shift` directive performs a **linear shift** of register values across PEs in a row. Unlike rotate, the vacated position is filled with a constant value instead of wrapping.

## Syntax

```c
#pragma shift(reg=R0, direction=left|right, distance=1, fill=0)
```

| Parameter | Values | Description |
|-----------|--------|-------------|
| `reg` | R0-R3 | Register to shift |
| `direction` | `left`, `right` | Shift direction |
| `distance` | 1-3 | Number of positions to shift |
| `fill` | integer | Value to insert at vacated position |

---

## Semantics

### Shift Right

Values move right. The leftmost PE gets the fill value.

```
Before: PE[0]=A, PE[1]=B, PE[2]=C, PE[3]=D

After #pragma shift(reg=R0, direction=right, distance=1, fill=0):
  PE[0]=0, PE[1]=A, PE[2]=B, PE[3]=C
```

### Shift Left

Values move left. The rightmost PE gets the fill value.

```
After #pragma shift(reg=R0, direction=left, distance=1, fill=0):
  PE[0]=B, PE[1]=C, PE[2]=D, PE[3]=0
```

---

## Example

```c
kernel "Shift" {
    config(0xF, 0);

    // Load different values into each PE
    cycle {
        @0,0: SADD R0, ZERO, IMM(10);
        @0,1: SADD R0, ZERO, IMM(20);
        @0,2: SADD R0, ZERO, IMM(30);
        @0,3: SADD R0, ZERO, IMM(40);
    }

    // Shift right by 1, fill with 0
    // Before: PE0=10, PE1=20, PE2=30, PE3=40
    // After:  PE0=0,  PE1=10, PE2=20, PE3=30
    #pragma shift(reg=R0, direction=right, distance=1, fill=0)

    cycle { @0,0: EXIT; }
}
```

---

## Generated Code

For `#pragma shift(reg=R0, direction=right, distance=1, fill=0)`:

```c
// Cycle 1: Broadcast R0 → ROUT on all PEs
row 0: SADD ROUT, R0, ZERO | SADD ROUT, R0, ZERO | SADD ROUT, R0, ZERO | SADD ROUT, R0, ZERO;

// Cycle 2: Interior PEs read from left neighbor (RCL), edge PE loads fill value
row 0: SADD R0, ZERO, IMM(0) | SADD R0, RCL, ZERO | SADD R0, RCL, ZERO | SADD R0, RCL, ZERO;
```

---

## Cycle Count

| Distance | Cycles |
|----------|--------|
| 1 | 2 |
| 2 | 2 |
| 3 | 2 |

---

## Use Cases

- **Sliding windows**: Shift data to align for stencil operations
- **Delay lines**: Insert zeros at the beginning of a pipeline
- **Array indexing offsets**: Access `A[i-1]` by shifting right

---

## Comparison with Rotate

| Aspect | `#pragma shift` | `#pragma rotate` |
|--------|----------------|-----------------|
| Edge behavior | Fills with constant | Wraps around |
| Data loss | Edge value lost | None |
| Use case | Sliding windows | Cyclic permutations |

---

## Limitations

1. **Row 0 only**: Operates on row 0 PEs
2. **Uses ROUT**: ROUT is overwritten during the shift
3. **Grid width 4**: Algorithm assumes 4-column grid
4. **Fill value is immediate**: Must be a compile-time constant

---

## Navigation

- [← Rotate](rotate.md)
- [Main Index](../../README.md)
