# 2D Arrays

[← Features Index](README.md) | [Main Index](../README.md)

---

2D arrays extend named arrays to support matrix-like data structures with row-major indexing, eliminating manual index calculations like `k % 4` or `i * 4 + j`.

## Syntax

```
.data2d name[rows][cols]           // Auto-init to zeros
.data2d name[rows][cols] { ... }   // With explicit values
.data2d name[total]                // Single dimension (infer square)
```

| Component | Required | Description |
|-----------|----------|-------------|
| `name` | Yes | Identifier for the 2D array |
| `[rows][cols]` | Yes* | Dimensions (rows × cols) |
| `[total]` | Yes* | Total elements (infers square dims) |
| `{ values }` | No | Initial values (zeros if omitted) |

*One dimension format is required.

## Declaration Examples

```c
// 4×4 matrix initialized to zeros
.data2d matrix[4][4]

// 2×3 matrix with explicit values (row-major order)
.data2d M[2][3] { 1, 2, 3, 4, 5, 6 }
// Memory layout: M[0][0]=1, M[0][1]=2, M[0][2]=3, M[1][0]=4, M[1][1]=5, M[1][2]=6

// 16 elements, automatically inferred as 4×4
.data2d grid[16]

// Non-square: 12 elements inferred as 1×12
.data2d vector[12]
```

## 2D Array Access

### Direct Access

```c
LWI R0, M[0][0]      // Element at row 0, col 0
LWI R1, M[1][2]      // Element at row 1, col 2
SWI R2, output[i][j] // Store with loop variables
```

### Loop Variable Support

```c
// Use numeric ranges that match your array dimensions
.data2d M[4][4]

for i in range(4) {
    for j in range(4) {
        cycle { @i,j: LWI R0, M[i][j]; }
    }
}
```

### Address Calculation (Row-Major)

The compiler calculates addresses using row-major order (C/Verilog style):

```
address = base + (row × cols + col) × 4
```

Example for `M[2][3]`:
- `M[0][0]` → index 0, address = base + 0
- `M[0][2]` → index 2, address = base + 8
- `M[1][0]` → index 3, address = base + 12
- `M[1][2]` → index 5, address = base + 20

## Array Properties

2D arrays extend the standard properties with dimension information:

| Property | Type | Description |
|----------|------|-------------|
| `.len()` | int | Total number of elements (rows × cols) |
| `.base()` | int | Base address in bytes |
| `.size()` | int | Total size in bytes (len × 4) |
| `.last()` | int | Index of last element (len - 1) |
| `.rows()` | int | Number of rows |
| `.cols()` | int | Number of columns |
| `.dim()` | int | Dimensionality (2 for 2D arrays) |

### Property Usage

Properties can be used for compile-time constants and future `range()` support:

```c
.data2d matrix[4][4]

// Properties return compile-time constants:
// matrix.dim() == 2
// matrix.len() == 16
// matrix.rows() == 4
// matrix.cols() == 4

// Currently, use numeric ranges:
for i in range(4) {
    for j in range(4) {
        cycle { @j,i: LWI R0, matrix[i][j]; }
    }
}
```

## Complete Examples

### Before (Manual Index Calculation)

```c
.data M { 1,2,3,4, 5,6,7,8, 9,10,11,12, 13,14,15,16 }

kernel "MatrixProcess" {
    config(0xF, 0);

    for i in range(4) {
        for j in range(4) {
            // Manual: k = i * 4 + j
            cycle { @i,j: LWI R0, M[i * 4 + j]; }
        }
    }

    cycle { @0,0: EXIT; }
}
```

### After (2D Arrays)

```c
.data2d M[4][4] { 1,2,3,4, 5,6,7,8, 9,10,11,12, 13,14,15,16 }

kernel "MatrixProcess" {
    config(0xF, 0);

    for i in range(4) {
        for j in range(4) {
            // Clear and intuitive: M[i][j] instead of M[i * 4 + j]
            cycle { @i,j: LWI R0, M[i][j]; }
        }
    }

    cycle { @0,0: EXIT; }
}
```

### Matrix Multiplication (Verified)

This example has been fully tested with simulation. The 2×2 matrix multiplication computes C = A × B:

**Input Matrices:**
```
A = | 1  2 |    B = | 5  6 |
    | 3  4 |        | 7  8 |
```

**Expected Output:**
```
C = | 1×5+2×7  1×6+2×8 |   =   | 19  22 |
    | 3×5+4×7  3×6+4×8 |       | 43  50 |
```

**OpenEdge-DSL Code:**
```c
.data2d A[2][2] { 1, 2, 3, 4 }
.data2d B[2][2] { 5, 6, 7, 8 }
.data2d C[2][2]

kernel "MatMul2x2" {
    config(0xF, 0);

    #pragma parallel collapse(2)
    for i in range(2) {
        for j in range(2) {
            // Initialize accumulator
            cycle { @i,j: SADD R0, ZERO, ZERO; }

            // k=0: R1=A[i][0], R2=B[0][j], R3=R1*R2, R0+=R3
            cycle { @i,j: LWI R1, A[i][0]; }
            cycle { @i,j: LWI R2, B[0][j]; }
            cycle { @i,j: SMUL R3, R1, R2; }
            cycle { @i,j: SADD R0, R0, R3; }

            // k=1: R1=A[i][1], R2=B[1][j], R3=R1*R2, R0+=R3
            cycle { @i,j: LWI R1, A[i][1]; }
            cycle { @i,j: LWI R2, B[1][j]; }
            cycle { @i,j: SMUL R3, R1, R2; }
            cycle { @i,j: SADD R0, R0, R3; }

            // Store result to C[i][j]
            cycle { @i,j: SWI R0, C[i][j]; }
        }
    }

    cycle { @0,0: EXIT; }
}
```

**Memory Layout After Execution:**
```
Address   Value    Reference
-------   -----    ---------
0         1        A[0][0]
4         2        A[0][1]
8         3        A[1][0]
12        4        A[1][1]
16        5        B[0][0]
20        6        B[0][1]
24        7        B[1][0]
28        8        B[1][1]
32        19       C[0][0] = 1×5 + 2×7
36        22       C[0][1] = 1×6 + 2×8
40        43       C[1][0] = 3×5 + 4×7
44        50       C[1][1] = 3×6 + 4×8
```

**Parallel Execution:** With `#pragma parallel collapse(2)`, all 4 PEs compute their C[i][j] elements simultaneously, completing the entire matrix multiplication in just 11 cycles.

### Matrix Multiplication (Scalable Pattern)

For larger matrices, the same pattern scales:

```c
.data2d A[4][4]
.data2d B[4][4]
.data2d C[4][4]  // Result matrix

kernel "MatMul4x4" {
    config(0xF, 0);

    #pragma parallel collapse(2)
    for i in range(4) {
        for j in range(4) {
            // Each PE computes C[i][j]
            cycle { @i,j: SADD R0, ZERO, ZERO; }  // Initialize accumulator

            for k in range(4) {
                cycle { @i,j: LWI R1, A[i][k]; }
                cycle { @i,j: LWI R2, B[k][j]; }
                cycle { @i,j: SMUL R3, R1, R2; }
                cycle { @i,j: SADD R0, R0, R3; }
            }

            cycle { @i,j: SWI R0, C[i][j]; }
        }
    }

    cycle { @0,0: EXIT; }
}
```

### Image Convolution (5-Point Stencil)

With complex index expressions, stencil operations are straightforward:

```c
.data2d image[8][8]
.data2d output[6][6]

kernel "Stencil5Point" {
    config(0xF, 0);

    for i in range(1, 7) {
        for j in range(1, 7) {
            // Load 5-point stencil neighbors
            cycle { @0,0: LWI R0, image[i-1][j]; }   // Top
            cycle { @0,0: LWI R1, image[i+1][j]; }   // Bottom
            cycle { @0,0: LWI R2, image[i][j-1]; }   // Left
            cycle { @0,0: LWI R3, image[i][j+1]; }   // Right
            
            // Compute average
            cycle { @0,0: SADD R0, R0, R1; }
            cycle { @0,0: SADD R0, R0, R2; }
            cycle { @0,0: SADD R0, R0, R3; }
            cycle { @0,0: SRT R0, R0, IMM(2); }  // Divide by 4
            
            // Store result
            cycle { @0,0: SWI R0, output[i-1][j-1]; }
        }
    }

    cycle { @0,0: EXIT; }
}
```

## Grid Auto-Configuration

When a 2D array is declared, the compiler calculates a suggested grid size based on the largest 2D array dimensions:

```c
.data2d matrix[4][6]  // Suggests 6×4 grid (width=cols, height=rows)
```

The `CompilationResult` includes:
```typescript
suggestedGridSize?: { width: number; height: number }
```

This enables the UI to automatically configure the CGRA grid to match the data dimensions.

## Memory Layout

2D arrays use row-major ordering, compatible with C and Verilog:

```
.data2d M[3][4] { 0,1,2,3, 4,5,6,7, 8,9,10,11 }

Address   Content    Array Reference
-------   -------    ---------------
0         0          M[0][0]
4         1          M[0][1]
8         2          M[0][2]
12        3          M[0][3]
16        4          M[1][0]
20        5          M[1][1]
24        6          M[1][2]
28        7          M[1][3]
32        8          M[2][0]
36        9          M[2][1]
40        10         M[2][2]
44        11         M[2][3]
```

## Error Handling

The compiler performs bounds checking at compile time when indices are constant:

```c
.data2d M[2][3]

// Valid
LWI R0, M[0][0]
LWI R0, M[1][2]

// Compile error: Row index 2 out of bounds for M[2][3]
LWI R0, M[2][0]

// Compile error: Column index 3 out of bounds for M[2][3]
LWI R0, M[0][3]
```

## Current Limitations

### Reserved Variable Names

The loop variable name `row` is reserved in OpenEdge-DSL for the legacy instruction format (`row 0: ...`). Use alternative names:

```c
// NOT allowed (row is reserved)
for row in range(4) { ... }

// Use instead
for r in range(4) { ... }
for i in range(4) { ... }
```

### Properties in range()

Array properties like `.rows()` and `.cols()` are supported inside `range()`:

```c
.data2d M[4][4]

kernel "PropertiesInRange" {
    config(0xF, 0);

    for i in range(M.rows()) {
        for j in range(M.cols()) {
            cycle { @i,j: LWI R0, M[i][j]; }
        }
    }

    cycle { @0,0: EXIT; }
}
```

### Complex Index Expressions

OpenEdge-DSL fully supports arithmetic expressions in 2D array indices. This enables powerful patterns like stencil operations:

```c
.data2d image[4][4] { 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16 }
.data2d output[2][2]

kernel "Stencil5Point" {
    config(0xF, 0);

    // Process interior 2x2 (avoiding boundaries of 4x4 image)
    for i in range(1, 3) {
        for j in range(1, 3) {
            // Load 5-point stencil neighbors
            cycle { @0,0: LWI R0, image[i-1][j]; }   // Top
            cycle { @0,0: LWI R1, image[i+1][j]; }   // Bottom
            cycle { @0,0: LWI R2, image[i][j-1]; }   // Left
            cycle { @0,0: LWI R3, image[i][j+1]; }   // Right
            cycle { @0,0: LWI ROUT, image[i][j]; }   // Center
            
            // Compute sum
            cycle { @0,0: SADD R0, R0, R1; }         // Top + Bottom
            cycle { @0,0: SADD R2, R2, R3; }         // Left + Right
            cycle { @0,0: SADD R0, R0, R2; }         // Combine
            cycle { @0,0: SADD R0, R0, ROUT; }       // + Center
            
            // Store result
            cycle { @0,0: SWI R0, output[i-1][j-1]; }
        }
    }

    cycle { @0,0: EXIT; }
}
```

> [!NOTE]
> This example uses `@0,0:` for all operations (sequential execution on PE 0,0).
> For parallel execution across PEs, use coordinates within the 4x4 grid bounds (0-3).

**Supported Expression Types:**

| Expression | Example | Description |
|------------|---------|-------------|
| Addition | `M[i+1][j]` | Offset by constant |
| Subtraction | `M[i-1][j]` | Negative offset |
| Multiplication | `M[i*2][j]` | Strided access |
| Division | `M[i/2][j]` | Downsampling |
| Modulo | `M[i%4][j]` | Wraparound access |
| Combined | `M[i-1][j+1]` | Diagonal neighbor |

**Note:** Both indices can contain expressions, and they're evaluated at compile time during loop unrolling.

### Image Convolution (Full Implementation)

With complex index expressions, full convolution is now possible:

```c
.data2d image[4][4] { 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16 }
.data2d output[2][2]

kernel "Convolution3x3" {
    config(0xF, 0);

    // Process interior 2x2 pixels (avoid boundaries)
    for y in range(1, 3) {
        for x in range(1, 3) {
            cycle { @0,0: SADD R0, ZERO, ZERO; }  // sum = 0

            // 5-point stencil (simplified kernel weights = 1)
            cycle { @0,0: LWI R1, image[y-1][x]; }  // Top
            cycle { @0,0: SADD R0, R0, R1; }
            cycle { @0,0: LWI R1, image[y+1][x]; }  // Bottom
            cycle { @0,0: SADD R0, R0, R1; }
            cycle { @0,0: LWI R1, image[y][x-1]; }  // Left
            cycle { @0,0: SADD R0, R0, R1; }
            cycle { @0,0: LWI R1, image[y][x+1]; }  // Right
            cycle { @0,0: SADD R0, R0, R1; }
            cycle { @0,0: LWI R1, image[y][x]; }    // Center
            cycle { @0,0: SADD R0, R0, R1; }
            
            // Normalize (divide by 5 via shift approximation)
            cycle { @0,0: SRT R0, R0, IMM(2); }
            
            // Store result
            cycle { @0,0: SWI R0, output[y-1][x-1]; }
        }
    }

    cycle { @0,0: EXIT; }
}
```

## Benefits

1. **Readability**: `M[i][j]` vs `M[i * cols + j]`
2. **Correctness**: Automatic address calculation prevents off-by-one errors
3. **Grid Integration**: Suggested grid size from array dimensions
4. **C Compatibility**: Row-major layout matches C/Verilog conventions
5. **Type Safety**: Compile-time bounds checking for constant indices

## Comparison with 1D Arrays

| Feature | 1D Array (.data) | 2D Array (.data2d) |
|---------|-----------------|-------------------|
| Declaration | `.data A { ... }` | `.data2d A[r][c] { ... }` |
| Access | `A[i]` | `A[i][j]` |
| Auto-init | No | Yes (zeros) |
| Properties | len, base, size, last | + rows, cols, dim |
| Grid suggestion | No | Yes |

## Autocomplete Support

The editor provides autocomplete for:
- `.data2d` directive with dimension placeholders
- 2D array names in expressions
- 2D array properties (`.rows()`, `.cols()`, `.dim()`)
- Loop snippets with 2D array iteration patterns

---

## Navigation

- [← Named Arrays](named-arrays.md)
- [Features Index](README.md)
- [Main Index](../README.md)
