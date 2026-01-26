# FFT Complex Multiplication

[← FFT Index](README.md) | [Main Index](../../README.md)

---

This document explains how complex multiplication works in FFT and how to implement it efficiently on CGRA with fixed-point arithmetic.

## Mathematical Background

### Complex Multiplication Formula

For two complex numbers `a + bi` and `c + di`:

```
(a + bi) × (c + di) = (ac - bd) + (ad + bc)i
```

In FFT butterfly, we compute:
```
Product = X[k+L] × W
```

Where:
- `X[k+L] = (x_r, x_i)` - input complex number
- `W = (w_r, w_i)` - twiddle factor

### Four Partial Products

```
mul_rr = x_r × w_r
mul_ii = x_i × w_i
mul_ri = x_r × w_i
mul_ir = x_i × w_r

Product_real = mul_rr - mul_ii
Product_imag = mul_ri + mul_ir
```

---

## Fixed-Point Arithmetic

### Q8.8 Format

We use Q8.8 fixed-point: 8 bits integer, 8 bits fraction.

**Scaling:** Multiply real values by 256 (2^8)

| Real Value | Q8.8 Representation |
|------------|---------------------|
| 1.0 | 256 |
| 0.707 | 181 |
| -0.293 | -75 |
| 0.5 | 128 |

### After Multiplication: Shift Right

When multiplying two Q8.8 numbers, result has 16 fractional bits. Must shift right by 8:

```c
cycle { @0,0: SMUL R0, R0, R1; }    // R0 = a × b (Q16.16)
cycle { @0,0: SRA R0, R0, IMM(8); } // R0 = result (Q8.8)
```

---

## DSL Implementation

### Complete Complex Multiplication

<!-- no-verify: Complex operations require manual verification -->
```c
// Complex multiplication: (80, 40) × (181, -75)
// Expected: Product = (68, 4) after >>8

.data x { 80, 40 }      // X[k+L] = (80, 40)
.data w { 181, -75 }    // W ≈ (0.707, -0.293) × 256
.data product { 0, 0 }  // Output

kernel "ComplexMul" {
    config(0xF, 0);

    // Load inputs
    cycle { @0,0: LWI R0, x[0]; }     // x_r = 80
    cycle { @0,0: LWI R1, x[1]; }     // x_i = 40
    cycle { @0,0: LWI R2, w[0]; }     // w_r = 181
    cycle { @0,0: LWI R3, w[1]; }     // w_i = -75

    // mul_rr = x_r × w_r = 80 × 181 = 14480
    cycle { @0,0: SMUL R0, R0, R2; }  // R0 = 14480
    
    // mul_ii = x_i × w_i = 40 × (-75) = -3000
    cycle { @0,1: LWI R0, x[1]; }
    cycle { @0,1: LWI R1, w[1]; }
    cycle { @0,1: SMUL R0, R0, R1; }  // R0 = -3000
    
    // Product_r = mul_rr - mul_ii = 14480 - (-3000) = 17480
    // (Need to combine results from different PEs or reload)
    cycle { @0,0: LWI R0, x[0]; }
    cycle { @0,0: LWI R1, w[0]; }
    cycle { @0,0: SMUL R0, R0, R1; }  // mul_rr = 14480
    cycle { @0,0: LWI R1, x[1]; }
    cycle { @0,0: LWI R2, w[1]; }
    cycle { @0,0: SMUL R1, R1, R2; }  // mul_ii = -3000
    cycle { @0,0: SSUB R0, R0, R1; }  // 14480 - (-3000) = 17480
    cycle { @0,0: SRA R0, R0, IMM(8); } // >> 8 = 68
    cycle { @0,0: SWI R0, product[0]; }
    
    // Product_i = mul_ri + mul_ir
    // mul_ri = 80 × (-75) = -6000
    // mul_ir = 40 × 181 = 7240
    // Sum = 1240 >> 8 = 4
    cycle { @0,0: LWI R0, x[0]; }     // 80
    cycle { @0,0: LWI R1, w[1]; }     // -75
    cycle { @0,0: SMUL R0, R0, R1; }  // -6000
    cycle { @0,0: LWI R1, x[1]; }     // 40
    cycle { @0,0: LWI R2, w[0]; }     // 181
    cycle { @0,0: SMUL R1, R1, R2; }  // 7240
    cycle { @0,0: SADD R0, R0, R1; }  // 1240
    cycle { @0,0: SRA R0, R0, IMM(8); } // 4
    cycle { @0,0: SWI R0, product[1]; }

    cycle { @0,0: EXIT; }
}
```

---

## Optimization: Parallel Multiplications

Instead of computing sequentially, use 4 PEs simultaneously:

```c
cycle {
    @0,0: SMUL R0, R0, R2;  // mul_rr = x_r × w_r
    @0,1: SMUL R0, R0, R3;  // mul_ri = x_r × w_i
    @0,2: SMUL R0, R1, R2;  // mul_ir = x_i × w_r
    @0,3: SMUL R0, R1, R3;  // mul_ii = x_i × w_i
}
```

This reduces 4 cycles to 1 cycle for multiplications!

---

## Common Twiddle Factors

For N-point FFT, common twiddle factors (×256 for Q8.8):

| W_N^k | Real | Imag | Q8.8 Real | Q8.8 Imag |
|-------|------|------|-----------|-----------|
| W_4^0 | 1.0 | 0.0 | 256 | 0 |
| W_4^1 | 0.0 | -1.0 | 0 | -256 |
| W_8^0 | 1.0 | 0.0 | 256 | 0 |
| W_8^1 | 0.707 | -0.707 | 181 | -181 |
| W_8^2 | 0.0 | -1.0 | 0 | -256 |
| W_8^3 | -0.707 | -0.707 | -181 | -181 |

---

## Navigation

- [← FFT Index](README.md)
- [Next: Dual Parallel →](fft-dual-parallel.md)
