# Pragma Transpose

[← Allreduce](allreduce.md) | [Main Index](../../README.md) | [Next: Gather →](gather.md)

---

The `#pragma transpose` directive transposes register values across the 4x4 PE grid. After execution, `PE(i,j).reg` contains the value that was originally at `PE(j,i).reg`.

## Syntax

```c
#pragma transpose(reg=R0)
```

| Parameter | Values | Description |
|-----------|--------|-------------|
| `reg` | R0-R3 | Register to transpose |

---

## Example

```c
kernel "MatrixTranspose" {
    config(0xFFFF, 0);

    // Load a 4x4 matrix:
    //  0  1  2  3
    //  4  5  6  7
    //  8  9 10 11
    // 12 13 14 15
    cycle {
        @0,0: SADD R0, ZERO, IMM(0);  @0,1: SADD R0, ZERO, IMM(1);
        @0,2: SADD R0, ZERO, IMM(2);  @0,3: SADD R0, ZERO, IMM(3);
        @1,0: SADD R0, ZERO, IMM(4);  @1,1: SADD R0, ZERO, IMM(5);
        @1,2: SADD R0, ZERO, IMM(6);  @1,3: SADD R0, ZERO, IMM(7);
        @2,0: SADD R0, ZERO, IMM(8);  @2,1: SADD R0, ZERO, IMM(9);
        @2,2: SADD R0, ZERO, IMM(10); @2,3: SADD R0, ZERO, IMM(11);
        @3,0: SADD R0, ZERO, IMM(12); @3,1: SADD R0, ZERO, IMM(13);
        @3,2: SADD R0, ZERO, IMM(14); @3,3: SADD R0, ZERO, IMM(15);
    }

    #pragma transpose(reg=R0)

    // After transpose:
    //  0  4  8 12
    //  1  5  9 13
    //  2  6 10 14
    //  3  7 11 15

    cycle { @0,0: EXIT; }
}
```

---

## Algorithm

The transpose swaps 6 off-diagonal pairs (the diagonal PE(i,i) keeps its own value):

| Pair | Distance | Swapped PEs |
|------|----------|-------------|
| 1 | 1 | PE(0,1) ↔ PE(1,0) |
| 2 | 1 | PE(1,2) ↔ PE(2,1) |
| 3 | 1 | PE(2,3) ↔ PE(3,2) |
| 4 | 2 | PE(0,2) ↔ PE(2,0) |
| 5 | 2 | PE(1,3) ↔ PE(3,1) |
| 6 | 3 | PE(0,3) ↔ PE(3,0) |

Each swap routes values through vertical (RCT/RCB) then horizontal (RCL/RCR) relay chains.

---

## Cycle Count

~27 cycles for a full 4x4 transpose (varies by swap distance):

| Distance | Cycles per swap | Count | Total |
|----------|----------------|-------|-------|
| 1 | 3 | 3 pairs | 9 |
| 2 | 5 | 2 pairs | 10 |
| 3 | 7 | 1 pair | 7 |
| Save | 1 | 1 | 1 |
| **Total** | | | **27** |

---

## Registers Used

| Register | Purpose |
|----------|---------|
| R2 | Saved original values |
| R3 | Relay temp for routing |
| `reg` | Updated with transposed value |

---

## Limitations

1. **Full 4x4 grid required**: All 16 PEs must be active (`config(0xFFFF, 0)`)
2. **Uses R2, R3**: These registers are overwritten
3. **Single register**: Only one register can be transposed per pragma

---

## Navigation

- [← Allreduce](allreduce.md)
- [Main Index](../../README.md)
- [Next: Gather →](gather.md)
