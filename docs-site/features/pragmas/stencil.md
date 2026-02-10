# Pragma Stencil

[← Reduce](reduce.md) | [Main Index](../../README.md) | [Tooling →](../../tooling/editor-support.md)

---

The `#pragma stencil` directive generates neighbor communication patterns for:
- Image filtering (convolution, blur, edge detection)
- Heat diffusion / Jacobi iteration
- Finite difference methods
- Cellular automata

## Syntax

```c
#pragma stencil(pattern, srcReg, destReg)              // Default: sum
#pragma stencil(pattern, operation, srcReg, destReg)   // Explicit operation
```

| Parameter | Values | Description |
|-----------|--------|-------------|
| `pattern` | `cross`, `horizontal`, `vertical` | Stencil pattern |
| `operation` | `sum`, `avg` | How to combine (default: `sum`) |
| `srcReg` | R0-R3, ROUT | Source register (center value) |
| `destReg` | R0-R3, ROUT | Destination register |

---

## Patterns

### Cross Pattern (5-point 2D stencil)

```
       RCT
        │
  RCL ─ ● ─ RCR
        │
       RCB
```

**Computes:** `result = SELF + RCT + RCB + RCL + RCR`

**Cycles:** 5

**For `avg`:** `result = (sum) / 4` (shift approximation)

**Note:** Requires ALL rows initialized. Use for 2D data (images, grids).

---

### Horizontal Pattern (3-point 1D stencil)

```
  RCL ─ ● ─ RCR
```

**Computes:** `result = SELF + RCL + RCR`

**Cycles:** 4

**For `avg`:** `result = (sum) / 2`

**Use case:** 1D arrays in row 0. Does NOT access RCT/RCB.

---

### Vertical Pattern (3-point 1D stencil)

```
       RCT
        │
        ●
        │
       RCB
```

**Computes:** `result = SELF + RCT + RCB`

**Cycles:** 4

**For `avg`:** `result = (sum) / 2`

**Use case:** Data in columns. Does NOT access RCL/RCR.

---

## Example: Simple Stencil Sum

```c
.data 0 { 10, 10, 10, 10 }

kernel "StencilSum" {
    config(0xF, 0);

    cycle { row 0: LWD R0; }

    #pragma stencil(cross, sum, R0, ROUT)

    cycle { row 0: SWD ROUT; }
    cycle { row 0: EXIT; }
}
```

**Generated (5 cycles):**

```c
// Center + Top
cycle { row 0: SADD R2, R0, RCT; }

// + Bottom
cycle { row 0: SADD R2, R2, RCB; }

// + Left
cycle { row 0: SADD R2, R2, RCL; }

// + Right
cycle { row 0: SADD R2, R2, RCR; }

// Output
cycle { row 0: SADD ROUT, R2, ZERO; }
```

---

## Example: 1D Smooth Filter (Horizontal)

For 1D arrays, use `horizontal` to avoid uninitialized RCT/RCB:

```c
.data 0 { 100, 50, 50, 50 }
.io_load { 0, 4, 8, 12 }

kernel "SmoothFilter1D" {
    config(0xF, 0);

    cycle { row 0: LWD R0 | LWD R0 | LWD R0 | LWD R0; }

    #pragma stencil(horizontal, avg, R0, ROUT)

    cycle { row 0: SWD ROUT; }
    cycle { row 0: EXIT; }
}
```

**Why use horizontal?**
- Cross reads RCT/RCB (vertical neighbors)
- For 1D data in row 0, other rows are uninitialized
- Horizontal only uses RCL/RCR

---

## Example: Jacobi Iteration

```c
.data 0 { 100, 50, 50, 50 }

kernel "JacobiStep" {
    config(0xF, 0);

    cycle { row 0: LWD R0; }

    // Average with neighbors
    #pragma stencil(cross, avg, R0, ROUT)

    cycle { row 0: PRINT ROUT, "temp"; }
    cycle { row 0: SWD ROUT; }
    cycle { row 0: EXIT; }
}
```

---

## Cycle Count

| Pattern | sum | avg |
|---------|-----|-----|
| cross | 5 | 5 |
| horizontal | 4 | 4 |
| vertical | 4 | 4 |

---

## Registers Used

| Register | Purpose |
|----------|---------|
| R2 | Accumulator |
| srcReg | Read only |
| destReg | Final result |

---

## Boundary Conditions

At grid boundaries, neighbor references wrap or return 0:

- **Row 0:** `RCT` references last row or 0
- **Col 0:** `RCL` references last column or 0

Consider boundary masks for edge PEs.

---

## Limitations

1. **Cross pattern only:** No box (8+1 neighbors) - CGRA lacks diagonals
2. **Uniform pattern:** All PEs execute same stencil
3. **Uses R2:** Register overwritten during computation
4. **Integer arithmetic:** Division uses shift (/4 not /5)

---

## Navigation

- [← Reduce](reduce.md)
- [Main Index](../../README.md)
- [Tooling →](../../tooling/editor-support.md)
