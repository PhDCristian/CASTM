# Pragma Rotate

[← Route](route.md) | [Main Index](../../README.md) | [Next: Shift →](shift.md)

---

The `#pragma rotate` directive performs a **circular rotation** of register values across PEs in a row. Values wrap around — no data is lost.

## Syntax

```c
#pragma rotate(reg=R0, direction=left|right, distance=1)
```

| Parameter | Values | Description |
|-----------|--------|-------------|
| `reg` | R0-R3 | Register to rotate |
| `direction` | `left`, `right` | Rotation direction |
| `distance` | 1-3 | Number of positions to shift |

---

## Semantics

### Rotate Left

Each PE receives the value from its **right** neighbor. The rightmost PE wraps around to receive from the leftmost.

```
Before: PE[0]=A, PE[1]=B, PE[2]=C, PE[3]=D

After #pragma rotate(reg=R0, direction=left, distance=1):
  PE[0]=B, PE[1]=C, PE[2]=D, PE[3]=A
```

### Rotate Right

Each PE receives the value from its **left** neighbor. The leftmost PE wraps around.

```
After #pragma rotate(reg=R0, direction=right, distance=1):
  PE[0]=D, PE[1]=A, PE[2]=B, PE[3]=C
```

---

## Example

```c
kernel "Rotate" {
    config(0xF, 0);

    // Load different values into each PE
    cycle {
        @0,0: SADD R0, ZERO, IMM(10);
        @0,1: SADD R0, ZERO, IMM(20);
        @0,2: SADD R0, ZERO, IMM(30);
        @0,3: SADD R0, ZERO, IMM(40);
    }

    // Rotate left by 1
    // Before: PE0=10, PE1=20, PE2=30, PE3=40
    // After:  PE0=20, PE1=30, PE2=40, PE3=10
    #pragma rotate(reg=R0, direction=left, distance=1)

    cycle { @0,0: EXIT; }
}
```

---

## Generated Code

For `#pragma rotate(reg=R0, direction=left, distance=1)`:

```c
// Cycle 1: Broadcast R0 → ROUT on all PEs
row 0: SADD ROUT, R0, ZERO | SADD ROUT, R0, ZERO | SADD ROUT, R0, ZERO | SADD ROUT, R0, ZERO;

// Cycle 2: Each PE reads from right neighbor (RCR), wrapping around
row 0: SADD R0, RCR, ZERO | SADD R0, RCR, ZERO | SADD R0, RCR, ZERO | SADD R0, RCR, ZERO;
```

---

## Cycle Count

| Distance | Cycles |
|----------|--------|
| 1 | 2 |
| 2 | 2 |
| 3 | 2 |

---

## Comparison with Shift

| Aspect | `#pragma rotate` | `#pragma shift` |
|--------|-----------------|----------------|
| Edge behavior | Wraps around | Fills with constant |
| Data loss | None | Edge value lost |
| Use case | Cyclic permutations | Sliding windows |

---

## Limitations

1. **Row 0 only**: Operates on row 0 PEs
2. **Uses ROUT**: ROUT is overwritten during the rotation
3. **Grid width 4**: Algorithm assumes 4-column grid

---

## Navigation

- [← Route](route.md)
- [Main Index](../../README.md)
- [Next: Shift →](shift.md)
