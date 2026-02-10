# Pragma Gather

[← Transpose](transpose.md) | [Main Index](../../README.md)

---

The `#pragma gather` directive collects values from all PEs in a row to a **configurable destination PE**, accumulating them with a specified operation.

## Syntax

```c
#pragma gather(src=R0, dest=@0,0, destReg=R1, op=add)
```

| Parameter | Values | Description |
|-----------|--------|-------------|
| `src` | R0-R3 | Source register on each PE |
| `dest` | `@row,col` | Destination PE coordinates |
| `destReg` | R0-R3 | Register for accumulated result |
| `op` | `add`, `and`, `or`, `xor`, `mul` | Accumulation operation |

---

## Gather vs Reduce

| Feature | `#pragma reduce` | `#pragma gather` |
|---------|-----------------|-----------------|
| Destination | Always PE(0,0) | Configurable `@row,col` |
| Algorithm | Tree (binary) | Sequential chain |
| Cycles | 4 | 7 |
| Operations | sum, max, min, and, or, xor, mul | add, and, or, xor, mul |

Use **reduce** for performance when the destination is PE(0,0). Use **gather** when you need a different destination PE.

---

## Example: Sum to PE(0,0)

```c
kernel "GatherSum" {
    config(0xF, 0);

    cycle {
        @0,0: SADD R0, ZERO, IMM(10);
        @0,1: SADD R0, ZERO, IMM(20);
        @0,2: SADD R0, ZERO, IMM(30);
        @0,3: SADD R0, ZERO, IMM(40);
    }

    #pragma gather(src=R0, dest=@0,0, destReg=R1, op=add)

    // PE(0,0).R1 = 100
    cycle { @0,0: EXIT; }
}
```

---

## Example: Gather to PE(0,2)

```c
kernel "GatherToMiddle" {
    config(0xF, 0);

    cycle {
        @0,0: SADD R0, ZERO, IMM(10);
        @0,1: SADD R0, ZERO, IMM(20);
        @0,2: SADD R0, ZERO, IMM(30);
        @0,3: SADD R0, ZERO, IMM(40);
    }

    #pragma gather(src=R0, dest=@0,2, destReg=R1, op=add)

    // PE(0,2).R1 = 100
    cycle { @0,0: EXIT; }
}
```

---

## Algorithm

The gather processes PEs sequentially, nearest first:

1. **Init**: Dest PE copies `src` to `destReg` (accumulator)
2. **For each other PE** (by distance from dest):
   - Source PE broadcasts `src` to ROUT
   - Intermediate PEs relay via RCR/RCL
   - Dest PE accumulates: `destReg = destReg OP received_value`

---

## Cycle Count

| Component | Cycles |
|-----------|--------|
| Init | 1 |
| Per PE (distance d) | d + 1 |
| **Total (4 PEs to PE(0,0))** | **1 + 2 + 3 + 4 = 10** |
| **Total (4 PEs to PE(0,1))** | **1 + 2 + 2 + 3 = 8** |

---

## Supported Operations

| Operation | Instruction | Description |
|-----------|-------------|-------------|
| `add` / `sum` | SADD | Sum |
| `and` | LAND | Bitwise AND |
| `or` | LOR | Bitwise OR |
| `xor` | LXOR | Bitwise XOR |
| `mul` | SMUL | Product |

---

## Registers Used

| Register | Purpose |
|----------|---------|
| R3 | Relay temp for intermediate PEs |
| `destReg` | Accumulated result at dest PE |

---

## Limitations

1. **Row 0 only**: Currently gathers across row 0
2. **Uses R3**: Relay register is overwritten on intermediate PEs
3. **Sequential**: More cycles than tree reduce for PE(0,0) destination

---

## Navigation

- [← Transpose](transpose.md)
- [Main Index](../../README.md)
