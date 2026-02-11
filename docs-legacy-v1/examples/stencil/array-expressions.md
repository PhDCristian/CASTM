# Array Index Expressions

[← Stencil Index](README.md) | [Examples Index](../README.md)

---

OpenEdge-DSL supports various arithmetic operations within 2D array index expressions. All expressions are evaluated at compile-time during loop unrolling.

## Supported Operations

| Operation | Syntax | Example |
|-----------|--------|---------|
| Addition | `i+N` | `M[i+1][j]` |
| Subtraction | `i-N` | `M[i-1][j]` |
| Multiplication | `i*N` | `M[i*2][j]` |
| Division | `i/N` | `M[i/2][j]` |
| Modulo | `i%N` | `M[i%4][j]` |
| Combined | `i+k` | `M[i-1+k][j]` |

---

## Example: Strided Access (Multiplication)

Access every other row using `i*2`:

```c
.data2d matrix[4][4] { 
    0, 1, 2, 3,
    4, 5, 6, 7,
    8, 9, 10, 11,
    12, 13, 14, 15
}

kernel "StridedAccess" {
    config(0xF, 0);

    // Access rows 0 and 2 (stride of 2)
    for i in range(2) {
        cycle { @0,0: LWI R0, matrix[i*2][0]; }
        // i=0: loads matrix[0][0] = 0
        // i=1: loads matrix[2][0] = 8
    }

    cycle { @0,0: EXIT; }
}
```

---

## Example: Downsampling (Division)

Downsample by reading every 2nd element:

```c
.data2d input[4][4] { 
    1, 2, 3, 4,
    5, 6, 7, 8,
    9, 10, 11, 12,
    13, 14, 15, 16
}
.data2d output[2][2]

kernel "Downsample" {
    config(0xF, 0);

    for i in range(4) {
        for j in range(4) {
            // Read from input
            cycle { @0,0: LWI R0, input[i][j]; }
            // Write to downsampled location
            cycle { @0,0: SWI R0, output[i/2][j/2]; }
        }
    }

    cycle { @0,0: EXIT; }
}
```

---

## Example: Circular Buffer (Modulo)

Wrap-around access pattern:

```c
.data2d buffer[4][4] { 
    0, 1, 2, 3,
    4, 5, 6, 7,
    8, 9, 10, 11,
    12, 13, 14, 15
}

kernel "CircularAccess" {
    config(0xF, 0);

    // Access pattern wraps around at column 4
    for i in range(8) {
        cycle { @0,0: LWI R0, buffer[0][i%4]; }
        // i=0: buffer[0][0], i=1: buffer[0][1], ...
        // i=4: buffer[0][0], i=5: buffer[0][1], ... (wraps)
    }

    cycle { @0,0: EXIT; }
}
```

---

## Example: Combined Expressions

Use multiple loop variables in expressions:

```c
.data2d matrix[4][4] { 
    0, 1, 2, 3,
    4, 5, 6, 7,
    8, 9, 10, 11,
    12, 13, 14, 15
}

kernel "CombinedExpressions" {
    config(0xF, 0);

    for i in range(2) {
        for j in range(2) {
            // Read 2x2 block starting at (i*2, j*2)
            cycle { @0,0: LWI R0, matrix[i*2][j*2]; }
            cycle { @0,0: LWI R1, matrix[i*2][j*2+1]; }
            cycle { @0,0: LWI R2, matrix[i*2+1][j*2]; }
            cycle { @0,0: LWI R3, matrix[i*2+1][j*2+1]; }
            
            // Sum the 2x2 block
            cycle { @0,0: SADD R0, R0, R1; }
            cycle { @0,0: SADD R2, R2, R3; }
            cycle { @0,0: SADD R0, R0, R2; }
        }
    }

    cycle { @0,0: EXIT; }
}
```

---

## Compile-Time Evaluation

All index expressions are evaluated during compilation when loops are unrolled:

```c
for i in range(2) {
    cycle { @0,0: LWI R0, M[i*2+1][0]; }
}

// Becomes:
// i=0: LWI R0, M[1][0]  (0*2+1 = 1)
// i=1: LWI R0, M[3][0]  (1*2+1 = 3)
```

---

## Bounds Checking

The compiler validates that computed indices are within array bounds:

```c
.data2d M[4][4]

for i in range(4) {
    cycle { @0,0: LWI R0, M[i+1][0]; }  // Error when i=3: index 4 out of bounds
}

// Fix: adjust range
for i in range(3) {  // 0, 1, 2
    cycle { @0,0: LWI R0, M[i+1][0]; }  // OK: indices 1, 2, 3
}
```

---

## Navigation

- [← Stencil Operations](stencil-operations.md)
- [Stencil Index](README.md)
