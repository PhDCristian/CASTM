# Named Arrays

[← Features Index](README.md) | [Main Index](../README.md)

---

Named arrays allow defining memory regions with descriptive names, improving code readability and reducing manual offset calculations.

## Syntax

```
.data [name] [address] { value1, value2, ... }
```

| Component | Required | Description |
|-----------|----------|-------------|
| `name` | No | Identifier for named access |
| `address` | No | Base address (auto-assigned if omitted) |
| `{ values }` | Yes | Comma-separated initial values |

## Declaration Examples

```c
// Auto-addressed arrays (sequential allocation)
.data input { 5, 10, 3 }          // Address 0
.data weights { 2, 20, 3 }        // Address 12 (after input)

// Explicit address
.data constants 100 { 42, 0, 0 }  // Fixed at address 100

// Mixed usage
.data buffer { 0, 0, 0, 0 }       // Auto: next available
.data lookup 200 { 1, 2, 4, 8 }   // Fixed at 200
```

## Array Access

### Named Access

```c
LWI R0, input[0]      // First element of input
LWI R1, weights[i]    // Element i of weights (loop variable)
SWI R2, output[0]     // Store to first element of output
```

### Global Access (Backward Compatible)

The global `data[index]` access remains supported:

```c
.data a { 1, 2, 3 }     // Global indices 0, 1, 2
.data b { 4, 5, 6 }     // Global indices 3, 4, 5

// Both work:
a[1]      // Element 1 of array 'a'
data[1]   // Same result (global index)
data[4]   // Element 1 of array 'b' (= b[1])
```

## Array Properties

Named arrays provide compile-time properties:

| Property | Type | Description |
|----------|------|-------------|
| `.len()` | int | Number of elements |
| `.base()` | int | Base address in bytes |
| `.size()` | int | Total size in bytes (len × 4) |
| `.last()` | int | Index of last element (len - 1) |

### Property Usage

```c
.data values { 1, 2, 3, 4, 5 }

// In for loop range
for i in range(values.len()) {
    cycle { @0,0: LWI R0, values[i]; }
}

// Access last element
cycle { @0,0: LWI R0, values[values.last()]; }

// Use base address
cycle { @0,0: SADD R1, values.base(), R0; }
```

## Complete Examples

### Before (Manual Offsets)

```c
.data 0 { 5, 10, 3, 2, 20, 3 }   // a[0..2], b[0..2] - manual comment

kernel "ConditionalDiff" {
    config(0xF, 0);

    for i in range(3) {
        cycle { @0,0: LWI R0, data[i]; }       // a[i]
        cycle { @0,0: LWI R1, data[3 + i]; }   // b[i] - offset 3 manual!
        // ...
    }
}
```

### After (Named Arrays)

```c
.data a { 5, 10, 3 }
.data b { 2, 20, 3 }

kernel "ConditionalDiff" {
    config(0xF, 0);

    for i in range(a.len()) {
        cycle { @0,0: LWI R0, a[i]; }     // Clear and direct
        cycle { @0,0: LWI R1, b[i]; }     // No manual calculations
        // ...
    }
}
```

### Vector Operations

```c
.data input { 10, 20, 30, 40 }
.data output { 0, 0, 0, 0 }

kernel "VectorDouble" {
    config(0xF, 0);

    #pragma parallel
    for i in range(input.len()) {
        cycle { @0,0: LWI R0, input[i]; }
        cycle { @0,0: SADD ROUT, R0, R0; }
        cycle { @0,0: SWI ROUT, output[i]; }
    }

    cycle { @0,0: EXIT; }
}
// Result: output = { 20, 40, 60, 80 }
```

### Reduction

```c
.data values { 10, 20, 30, 40 }

kernel "SumReduce" {
    config(0xF, 0);

    #pragma parallel
    for i in range(values.len()) {
        cycle { @0,0: LWI R0, values[i]; }
    }

    #pragma reduce(sum, R0, ROUT)

    cycle { @0,0: SWD ROUT; }
    cycle { @0,0: EXIT; }
}
// Result: 100
```

## Memory Layout

Named arrays are allocated sequentially unless explicit addresses are provided:

```
Address   Content    Array Reference
-------   -------    ---------------
0         5          a[0], data[0]
4         10         a[1], data[1]
8         3          a[2], data[2]
12        2          b[0], data[3]
16        20         b[1], data[4]
20        3          b[2], data[5]
...
100       42         constants[0]
```

## Benefits

1. **Readability**: `input[i]` vs `data[3 + i]`
2. **Maintainability**: Adding elements doesn't break other arrays
3. **Safety**: Compile-time bounds checking when possible
4. **Self-documenting**: Array names describe their purpose

## Autocomplete Support

The editor provides autocomplete for:
- Array names after `.data`
- Array properties after typing `.` (`.len()`, `.base()`, etc.)
- Named array snippets (`data_named`, `for_named_array`)

---

## Navigation

- [← Features Index](README.md)
- [Main Index](../README.md)
