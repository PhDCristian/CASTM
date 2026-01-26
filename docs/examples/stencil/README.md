# Stencil and Array Operations Examples

[← Examples Index](README.md) | [Main Index](../../README.md)

---

This folder contains examples demonstrating advanced array operations and stencil patterns using OpenEdge-DSL's support for complex 2D array index expressions.

## Contents

| Example | Description | Key Features |
|---------|-------------|--------------|
| [Simple Stencil](stencil-operations.md) | 5-point and 3-point stencil patterns | `M[i-1][j]`, `M[i+1][j]` |
| [Array Expressions](array-expressions.md) | Various index arithmetic | `M[i*2][j]`, `M[i/2][j%4]` |

## Prerequisites

These examples require understanding of:
- 2D array declaration (`.data2d`)
- For loops (`for i in range(...)`)
- Basic CGRA instructions (`LWI`, `SWI`, `SADD`)

## Key Concept: Complex Index Expressions

OpenEdge-DSL supports arithmetic expressions within 2D array indices:

```c
.data2d matrix[4][4]

for i in range(1, 3) {
    for j in range(1, 3) {
        // All of these work:
        cycle { @0,0: LWI R0, matrix[i-1][j]; }   // Offset by -1
        cycle { @0,0: LWI R1, matrix[i+1][j]; }   // Offset by +1
        cycle { @0,0: LWI R2, matrix[i][j-1]; }   // Column offset
        cycle { @0,0: LWI R3, matrix[i][j+1]; }   // Column offset
    }
}
```

This enables powerful patterns like:
- **Stencil operations** (image processing, scientific computing)
- **Convolution kernels** (filters, edge detection)
- **Sliding window** algorithms

---

## Navigation

- [Stencil Operations →](stencil-operations.md)
- [Array Expressions →](array-expressions.md)
