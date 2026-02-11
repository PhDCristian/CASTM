# Stencil Operations

[← Stencil Index](README.md) | [Examples Index](../README.md)

---

Stencil operations are fundamental patterns in image processing and scientific computing where each output element is computed from its neighbors in an input array.

## 5-Point Stencil (Cross Pattern)

The classic 5-point stencil uses the center element and its 4 orthogonal neighbors:

```
    [i-1][j]
       ↑
[i][j-1] ← [i][j] → [i][j+1]
       ↓
    [i+1][j]
```

### Example: 5-Point Average

```c
.data2d input[4][4] { 
    1, 2, 3, 4,
    5, 6, 7, 8,
    9, 10, 11, 12,
    13, 14, 15, 16
}
.data2d output[2][2]

kernel "Stencil5Point" {
    config(0xF, 0);

    // Process interior 2x2 (avoiding boundary pixels)
    for i in range(1, 3) {
        for j in range(1, 3) {
            // Load 5-point stencil neighbors
            cycle { @0,0: LWI R0, input[i-1][j]; }   // Top
            cycle { @0,0: LWI R1, input[i+1][j]; }   // Bottom
            cycle { @0,0: LWI R2, input[i][j-1]; }   // Left
            cycle { @0,0: LWI R3, input[i][j+1]; }   // Right
            cycle { @0,0: LWI ROUT, input[i][j]; }   // Center
            
            // Compute sum
            cycle { @0,0: SADD R0, R0, R1; }         // Top + Bottom
            cycle { @0,0: SADD R2, R2, R3; }         // Left + Right
            cycle { @0,0: SADD R0, R0, R2; }         // Combine
            cycle { @0,0: SADD R0, R0, ROUT; }       // + Center
            
            // Store result (sum of 5 neighbors)
            cycle { @0,0: SWI R0, output[i-1][j-1]; }
        }
    }

    cycle { @0,0: EXIT; }
}
```

**How it works:**
- For i=1, j=1: Reads input[0][1], input[2][1], input[1][0], input[1][2], input[1][1]
- For i=1, j=2: Reads input[0][2], input[2][2], input[1][1], input[1][3], input[1][2]
- And so on...

---

## 3-Point Stencil (Horizontal)

For 1D filtering or horizontal blur:

```c
.data2d input[4][4] { 
    1, 2, 3, 4,
    5, 6, 7, 8,
    9, 10, 11, 12,
    13, 14, 15, 16
}
.data2d output[4][2]

kernel "HorizontalStencil" {
    config(0xF, 0);

    for i in range(4) {
        for j in range(1, 3) {
            // Load 3-point horizontal neighbors
            cycle { @0,0: LWI R0, input[i][j-1]; }   // Left
            cycle { @0,0: LWI R1, input[i][j]; }     // Center
            cycle { @0,0: LWI R2, input[i][j+1]; }   // Right
            
            // Sum all three
            cycle { @0,0: SADD R0, R0, R1; }
            cycle { @0,0: SADD R0, R0, R2; }
            
            // Store
            cycle { @0,0: SWI R0, output[i][j-1]; }
        }
    }

    cycle { @0,0: EXIT; }
}
```

---

## Diagonal Stencil

Access diagonal neighbors:

```c
.data2d input[4][4] { 
    1, 2, 3, 4,
    5, 6, 7, 8,
    9, 10, 11, 12,
    13, 14, 15, 16
}
.data2d output[2][2]

kernel "DiagonalStencil" {
    config(0xF, 0);

    for i in range(1, 3) {
        for j in range(1, 3) {
            // Load 4 diagonal neighbors
            cycle { @0,0: LWI R0, input[i-1][j-1]; }  // Top-left
            cycle { @0,0: LWI R1, input[i-1][j+1]; }  // Top-right
            cycle { @0,0: LWI R2, input[i+1][j-1]; }  // Bottom-left
            cycle { @0,0: LWI R3, input[i+1][j+1]; }  // Bottom-right
            
            // Sum diagonals
            cycle { @0,0: SADD R0, R0, R1; }
            cycle { @0,0: SADD R2, R2, R3; }
            cycle { @0,0: SADD R0, R0, R2; }
            
            // Store
            cycle { @0,0: SWI R0, output[i-1][j-1]; }
        }
    }

    cycle { @0,0: EXIT; }
}
```

---

## Use Cases

| Pattern | Application |
|---------|-------------|
| 5-point cross | Laplacian, heat equation |
| 3-point horizontal | 1D filters, horizontal blur |
| 3-point vertical | Vertical edge detection |
| 4-point diagonal | Corner detection |
| 9-point (3x3) | Gaussian blur, convolution |

---

## Performance Notes

1. **Boundary handling**: Examples start loops at index 1 and end before the last index to avoid out-of-bounds access
2. **Sequential execution**: Using `@0,0:` runs all operations on PE(0,0) sequentially
3. **Parallel execution**: Use `@i,j:` with grid-sized loops for parallel stencil computation

---

## Navigation

- [← Stencil Index](README.md)
- [Array Expressions →](array-expressions.md)
