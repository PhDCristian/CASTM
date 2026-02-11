# Pragma Scan

[← Reduce](reduce.md) | [Main Index](../../README.md) | [Next: Broadcast →](broadcast.md)

---

The `#pragma scan` directive performs **prefix operations** (also known as scan or prefix sum) across PE columns or rows. Each PE receives the accumulated result from all previous PEs.

## Syntax

```c
#pragma scan(operation, srcReg, dstReg, direction)
#pragma scan(operation, srcReg, dstReg, direction, mode)
```

| Parameter | Values | Description |
|-----------|--------|-------------|
| `operation` | `add`, `max`, `min`, `and`, `or`, `xor` | Associative operation |
| `srcReg` | R0-R3 | Source register |
| `dstReg` | R0-R3 | Destination register |
| `direction` | `right`, `left`, `down`, `up` | Propagation direction |
| `mode` | `inclusive` (default), `exclusive` | Include current PE's value? |

---

## Semantics

### Inclusive Scan (Default)

Each PE receives the sum of all values up to and including itself:

```
Before: PE[0].R0=a, PE[1].R0=b, PE[2].R0=c, PE[3].R0=d

After #pragma scan(add, R0, R1, right):
  PE[0].R1 = a
  PE[1].R1 = a + b
  PE[2].R1 = a + b + c
  PE[3].R1 = a + b + c + d
```

### Exclusive Scan

Each PE receives the sum of all values before itself (identity for first PE):

```
After #pragma scan(add, R0, R1, right, exclusive):
  PE[0].R1 = 0           (identity for add)
  PE[1].R1 = a
  PE[2].R1 = a + b
  PE[3].R1 = a + b + c
```

---

## Direction

| Direction | Flow | Use Case |
|-----------|------|----------|
| `right` | Col 0 → Col 3 | Horizontal prefix sum |
| `left` | Col 3 → Col 0 | Reverse prefix |
| `down` | Row 0 → Row 3 | Vertical prefix sum |
| `up` | Row 3 → Row 0 | Reverse vertical |

---

## Supported Operations

| Operation | Identity | Instruction |
|-----------|----------|-------------|
| `add` | 0 | SADD |
| `max` | MIN_INT | BSFA pattern |
| `min` | MAX_INT | BSFA pattern |
| `and` | 0xFFFFFFFF | LAND |
| `or` | 0 | LOR |
| `xor` | 0 | LXOR |

---

## Examples

### Basic Prefix Sum

```c
.data 0 { 1, 2, 3, 4 }

kernel "PrefixSum" {
    config(0xF, 0);

    // Load values: Col0=1, Col1=2, Col2=3, Col3=4
    #pragma parallel
    for i in range(4) {
        cycle { @0,0: LWI R0, data[i]; }
    }

    // Inclusive prefix sum: [1, 3, 6, 10]
    #pragma scan(add, R0, R1, right)

    // Store results
    #pragma parallel
    for i in range(4) {
        cycle { @0,0: SWI R1, 100+i*4; }
    }

    cycle { @0,0: EXIT; }
}
```

**Result:** memory[100]=1, memory[104]=3, memory[108]=6, memory[112]=10

### Running Maximum

```c
.data 0 { 3, 7, 2, 9 }

kernel "RunningMax" {
    config(0xF, 0);

    #pragma parallel
    for i in range(4) {
        cycle { @0,0: LWI R0, data[i]; }
    }

    // Running max: [3, 7, 7, 9]
    #pragma scan(max, R0, R1, right)

    #pragma parallel
    for i in range(4) {
        cycle { @0,0: SWI R1, 100+i*4; }
    }

    cycle { @0,0: EXIT; }
}
```

**Result:** memory[100]=3, memory[104]=7, memory[108]=7, memory[112]=9

### Carry Chain (Limb Arithmetic)

For multi-precision arithmetic, propagate carries between limbs:

```c
// Each PE has a limb value that may overflow 16 bits
// After operation, extract carry and propagate

kernel "CarryChain" {
    config(0xF, 0);

    // Assume R0 has values that need carry propagation
    // R0 in each column: raw limb values

    // Extract carry (bits 16+)
    #pragma parallel
    for i in range(4) {
        cycle { @0,0: SRT R1, R0, 16; }      // R1 = carry
        cycle { @0,0: LAND R0, R0, 65535; }  // R0 = low 16 bits
    }

    // Propagate carries: each PE adds carry from left neighbor
    #pragma scan(add, R1, R2, right, exclusive)

    // Add accumulated carry to current value
    #pragma parallel
    for i in range(4) {
        cycle { @0,0: SADD R0, R0, R2; }
    }

    cycle { @0,0: EXIT; }
}
```

---

## Generated Code

For `#pragma scan(add, R0, R1, right)`:

```c
// Step 1: Initialize PE[0]
cycle { @0,0: SADD R1, R0, ZERO; }

// Step 2: PE[0] sends, PE[1] receives and accumulates
cycle { @0,0: SADD ROUT, R0, ZERO; }
cycle { @0,1: SADD R1, R0, RCL; }

// Step 3: PE[1] sends, PE[2] receives and accumulates
cycle { @0,1: SADD ROUT, R1, ZERO; }
cycle { @0,2: SADD R1, R0, RCL; }

// Step 4: PE[2] sends, PE[3] receives and accumulates
cycle { @0,2: SADD ROUT, R1, ZERO; }
cycle { @0,3: SADD R1, R0, RCL; }
```

---

## Cycle Count

| Direction | Cycles |
|-----------|--------|
| `right`/`left` | 2 * (N-1) + 1 = 7 for 4 columns |
| `down`/`up` | 2 * (N-1) + 1 = 7 for 4 rows |

---

## Comparison with Reduce

| Aspect | `#pragma reduce` | `#pragma scan` |
|--------|------------------|----------------|
| Result location | Single PE (col 0) | All PEs |
| Pattern | All → One | All → All (prefix) |
| Use case | Final sum | Running totals, carries |

---

## Limitations

1. **Row 0 only** (for horizontal): Operates on row 0 PEs
2. **Column 0 only** (for vertical): Operates on column 0 PEs
3. **Uses ROUT**: ROUT is overwritten during propagation
4. **Sequential dependency**: Cannot be parallelized further

---

## Navigation

- [← Reduce](reduce.md)
- [Main Index](../../README.md)
- [Next: Broadcast →](broadcast.md)
