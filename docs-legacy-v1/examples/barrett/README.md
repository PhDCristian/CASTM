# Barrett Modular Squaring Example

This example demonstrates porting a Barrett modular reduction algorithm from Python to OpenEdgeDSL, utilizing the new DSL extensions.

## Algorithm Overview

Barrett reduction computes `x² mod p` without expensive division:

```
1. Extract bytes from X (32-bit input)
2. Compute products s_ij = A_i * A_j (squaring matrix)
3. Accumulate to coefficients c_k = sum_{i+j=k}(w_ij * s_ij)
4. Convert coefficients (base 256) to limbs (base 65536)
5. Reconstruct full product: L0 + L1*65536 + L2*2^32 + ...
6. Apply Barrett reduction: R = L - q̂*p
```

## DSL Features Used

### Computed Constants

Memory layout is defined using computed constants for readability:

```c
.const S_BASE 400
.const S00 S_BASE + 0    // = 400
.const S01 S_BASE + 4    // = 404
.const S02 S_BASE + 8    // = 408

.const C_BASE 300
.const C0 C_BASE + 0     // = 300
.const C1 C_BASE + 4     // = 304
```

### Coordinate Expressions

Byte extraction uses loop variable in coordinates:

```c
for i in range(4) {
    cycle { @i,0: LWI R0, 0; @i,1: LWI R0, 0; @i,2: LWI R0, 0; @i,3: LWI R0, 0; }
}
```

### Carry Propagation Pattern

Carry between PEs requires explicit ROUT/RCx communication:

```c
// L0: extract carry, mask, store, send
cycle { @0,0: SRT R3, R0, 16; }      // carry -> R3
cycle { @0,0: LAND R0, R0, 65535; }  // mask lower 16 bits
cycle { @0,0: SWI R0, L0_ADDR; }     // store L0
cycle { @0,0: SADD ROUT, R3, ZERO; } // send carry to right

// L1: receive and accumulate
cycle { @0,1: SADD R0, R0, RCL; }    // L1 + carry_from_L0
```

## Memory Layout

| Region | Address | Description |
|--------|---------|-------------|
| `X` | 0 | Input value |
| `P` | 4 | Prime modulus |
| `μ` | 16 | Barrett constant |
| `C_BASE` | 300-324 | Coefficients c0..c6 |
| `L_BASE` | 360-384 | Limbs L0..L3 |
| `S_BASE` | 400-436 | Products s_ij |
| `RES_ADDR` | 700 | Output result |

## PE Assignment

```
      Col 0     Col 1     Col 2     Col 3
Row 0  (0,0)     (0,1)     (0,2)     (0,3)     ← Limb computation
Row 1  (1,0)     (1,1)     (1,2)     (1,3)     
Row 2  (2,0)     (2,1)     (2,2)     (2,3)     
Row 3  (3,0)     (3,1)     (3,2)     (3,3)     

PE (i,j) computes: s_ij = A_i * A_j
```

## Test Results

| Input | Expected | Result |
|-------|----------|--------|
| 0 | 0 | ✓ |
| 1 | 1 | ✓ |
| 100 | 10000 | ✓ |
| 0x1234 | 21715600 | ✓ |
| 0x7FFF | 1073676289 | ✓ |

## Running Tests

```bash
npm test -- --run src/core/dsl/__tests__/barrett-squaring.test.ts
```

## Files

- [barrett_v2.edsl](file:///Users/ccampos/UMA/ZKP/CGRA-simulator/examples/dsl_port/barrett_v2.edsl) - Complete DSL implementation
- [barrett-squaring.test.ts](file:///Users/ccampos/UMA/ZKP/CGRA-simulator/src/core/dsl/__tests__/barrett-squaring.test.ts) - Test suite (14 tests)

## E2E Comparison with Python

| Metric | Python Generator | DSL |
|--------|-----------------|-----|
| Cycles | ~104 | ~58 |
| LWI instructions | 19 | 10 |
| SMUL instructions | 11 | 4 |
| SADD instructions | 81 | 19 |

The DSL version is more compact due to:
- Loop unrolling with coordinate expressions
- Simpler coefficient accumulation
- Direct product reconstruction (no full Barrett q̂ computation)

**Note**: Both produce correct x² results for inputs < 2^16.

## Known Limitations

1. **32-bit overflow**: Results > 2^31 wrap as signed integers
2. **No modular reduction**: Current version outputs x² directly without mod p
3. **Input range**: Tested for x < 2^16 (results fit in 32 bits)

## Next Steps

- [ ] Implement full Barrett reduction (q̂ * p subtraction)
- [ ] Port multiplication module (x * y mod p)
- [ ] Add modular correction for overflow
