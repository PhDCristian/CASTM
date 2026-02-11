# Proposal v2: Named Arrays for OpenEdge-DSL

[← Back to Index](../README.md)

---

## Summary

This proposal introduces **named arrays** to OpenEdge-DSL, allowing developers to define and access memory regions by name instead of calculating global offsets manually.

**Status:** ✅ Implemented
**Version:** 2.0
**Date:** 2025-01-26

---

## Motivation

### Current Limitation

All `.data` blocks combine into a single address space accessible only via `data[index]`:

```c
.data 0 { 5, 10, 3, 2, 20, 3 }   // a[0..2], b[0..2] - manual comment

// Access requires manual offset calculation:
LWI R0, data[i]       // a[i]
LWI R1, data[3 + i]   // b[i] - offset 3 calculated manually
```

### Problems

1. **Error-prone**: Manual offset calculations lead to bugs
2. **Hard to maintain**: Adding elements to one array shifts all subsequent offsets
3. **Poor readability**: Code intent is obscured by magic numbers
4. **No compile-time validation**: Out-of-bounds access not detectable

---

## Proposed Syntax

### Array Declaration

```c
.data <name> [address] { value1, value2, ... }
```

| Component | Required | Description |
|-----------|----------|-------------|
| `name` | Yes | Identifier for the array (alphanumeric + underscore) |
| `address` | No | Base address (auto-assigned if omitted) |
| `{ values }` | Yes | Comma-separated initial values |

**Examples:**

```c
// Auto-addressed arrays (sequential allocation)
.data input { 5, 10, 3 }          // Address 0
.data weights { 2, 20, 3 }        // Address 12 (after input)

// Explicit address
.data constants 100 { 42, 0, 0 }  // Fixed at address 100

// Mixed usage
.data buffer { 0, 0, 0, 0 }       // Auto: next available
.data lookup_table 200 { 1, 2, 4, 8, 16 }  // Fixed at 200
```

### Array Access

```c
// Named access
LWI R0, input[0]      // First element of input
LWI R1, weights[i]    // Element i of weights

// Global access still works
LWI R2, data[0]       // Same as input[0]
LWI R3, data[3]       // Same as weights[0]
```

### Array Properties

Compile-time properties available on all named arrays:

| Property | Type | Description | Example |
|----------|------|-------------|---------|
| `.len()` | int | Number of elements | `input.len()` → 3 |
| `.base()` | int | Base address in bytes | `input.base()` → 0 |
| `.size()` | int | Total size in bytes | `input.size()` → 12 |
| `.last()` | int | Index of last element | `input.last()` → 2 |

**Usage in loops:**

```c
.data values { 1, 2, 3, 4, 5 }

for i in range(values.len()) {
    cycle { @0,0: LWI R0, values[i]; }
}

// Access last element
cycle { @0,0: LWI R0, values[values.last()]; }  // values[4] = 5
```

---

## Syntax Rationale

### Design Decisions

**1. Name before address** (like Verilog/CUDA):
```c
// OpenEdge-DSL (proposed)
.data constants 100 { 42, 0 }

// Similar to Verilog
reg [31:0] constants [0:1];

// Similar to CUDA
__device__ int constants[2];
```

**2. Function-style properties** (like C/C++):
```c
// OpenEdge-DSL (proposed)
input.len()    // Function call style
input.last()

// Similar to C++ STL
vec.size()
vec.back()

// Similar to Halide
buf.width()
buf.extent(0)
```

**3. Bracket indexing** (universal convention):
```c
// OpenEdge-DSL
input[i]

// Same as C, Verilog, CUDA, Halide, Python...
array[index]
```

---

## Compatibility

### Backward Compatible

Existing code continues to work:

```c
// Old style (still valid)
.data 0 { 1, 2, 3, 4, 5, 6 }
LWI R0, data[0]
LWI R1, data[3]

// New style (enhanced)
.data a { 1, 2, 3 }
.data b { 4, 5, 6 }
LWI R0, a[0]      // Same as data[0]
LWI R1, b[0]      // Same as data[3]
```

### Migration Path

Gradual adoption without breaking changes:

1. **Phase 1**: Named arrays coexist with anonymous `.data`
2. **Phase 2**: Deprecation warnings for anonymous `.data` without name
3. **Phase 3**: Full adoption (optional)

---

## Examples

### Before and After

**Before (current):**
```c
.data 0 { 5, 10, 3, 2, 20, 3 }   // a[0..2] = {5,10,3}, b[0..2] = {2,20,3}

kernel "ConditionalDiff" {
    config(0xF, 0);

    for i in range(3) {
        cycle { @0,0: LWI R0, data[i]; }       // a[i] - offset 0
        cycle { @0,0: LWI R1, data[3 + i]; }   // b[i] - offset 3 manual!
        // ...
    }
}
```

**After (proposed):**
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

### Vector Sum with Named Arrays

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

### Matrix Operations

```c
// 2x2 matrices stored row-major
.data matrix_a { 1, 2, 3, 4 }    // [[1,2], [3,4]]
.data matrix_b { 5, 6, 7, 8 }    // [[5,6], [7,8]]
.data result { 0, 0, 0, 0 }

kernel "MatrixAdd" {
    config(0xF, 0);

    for i in range(matrix_a.len()) {
        cycle { @0,0: LWI R0, matrix_a[i]; }
        cycle { @0,0: LWI R1, matrix_b[i]; }
        cycle { @0,0: SADD ROUT, R0, R1; }
        cycle { @0,0: SWI ROUT, result[i]; }
    }

    cycle { @0,0: EXIT; }
}
// Result: result = { 6, 8, 10, 12 }
```

### Reduction with Named Arrays

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
// Result: 100 (sum of all values)
```

---

## Implementation Notes

### Compiler Changes

1. **Symbol table**: Track array names, base addresses, and lengths
2. **Address resolver**: Replace `array[i]` with `base + i * 4`
3. **Property expansion**: Replace `.len()`, `.base()`, etc. with constants
4. **Validation**: Check array bounds at compile time when possible

### Memory Layout

```
Address   Content          Array Reference
-------   -------          ---------------
0         5                a[0], data[0]
4         10               a[1], data[1]
8         3                a[2], data[2]
12        2                b[0], data[3]
16        20               b[1], data[4]
20        3                b[2], data[5]
...
100       42               constants[0]
104       0                constants[1]
```

### Error Messages

```
Error at line 5, column 12:
  Array index out of bounds: input[5] (array length is 4)

Error at line 8, column 8:
  Undefined array 'inputs'. Did you mean 'input'?

Warning at line 12:
  Address collision: 'buffer' (addr 12) overlaps with 'weights' (addr 8-16)
```

---

## Files to Update (When Implemented)

1. [spec/02-program-structure.md](../spec/02-program-structure.md) - New `.data` syntax
2. [spec/04-instruction-set.md](../spec/04-instruction-set.md) - Array operands in LWI/SWI
3. [tooling/editor-support.md](../tooling/editor-support.md) - Autocomplete for array names/properties
4. [features/README.md](../features/README.md) - Link to named arrays feature
5. Create `features/named-arrays.md` - Complete documentation

---

## Related Work

| Language | Array Declaration | Access | Properties |
|----------|-------------------|--------|------------|
| **Verilog** | `reg [31:0] arr [0:3];` | `arr[i]` | `$size(arr)` |
| **CUDA** | `__device__ int arr[4];` | `arr[i]` | `sizeof(arr)` |
| **Halide** | `Buffer<int> buf(4);` | `buf(i)` | `buf.width()` |
| **OpenCL** | `__global int* arr;` | `arr[i]` | N/A |
| **OpenEdge** | `.data arr { 1,2,3,4 }` | `arr[i]` | `arr.len()` |

---

## Navigation

- [← Back to Index](../README.md)
- [Original Proposal v1](./Proposal_v1.md)
