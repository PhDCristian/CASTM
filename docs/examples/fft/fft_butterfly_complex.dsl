// ============================================================================
// FFT Radix-2 Butterfly - Paper's Full Complex Version
// ============================================================================
// Based on: "Efficient and Flexible Implementation of FFT Application 
//           for CGRA Processor" (Yi et al., ICSP 2023) - Figure 2
//
// This version uses REAL twiddle factors with complex multiplication
// and fixed-point arithmetic (Q8.8 format with >>8 shift).
//
// ============================================================================
// MATHEMATICAL CALCULATION
// ============================================================================
//
// Inputs:
//   X[k]   = (100, 50)   - complex input
//   X[k+L] = (80, 40)    - complex input
//   W      = (181, -75)  - twiddle ≈ (0.707, -0.293) scaled by 256
//
// Step 1: Complex Multiplication (X[k+L] × W)
//   Product_r = X[kL]_r × W_r - X[kL]_i × W_i
//             = 80 × 181 - 40 × (-75)
//             = 14480 + 3000 = 17480
//             → 17480 >> 8 = 68  (fixed-point shift)
//
//   Product_i = X[kL]_r × W_i + X[kL]_i × W_r
//             = 80 × (-75) + 40 × 181
//             = -6000 + 7240 = 1240
//             → 1240 >> 8 = 4  (fixed-point shift)
//
//   Product = (68, 4)
//
// Step 2: Butterfly
//   Top    = X[k] + Product = (100+68, 50+4) = (168, 54)
//   Bottom = X[k] - Product = (100-68, 50-4) = (32, 46)
//
// ============================================================================
// EXPECTED MEMORY RESULTS
// ============================================================================
//   top[0]    @ addr 24 (word 6):  168  ← Top_real
//   top[1]    @ addr 28 (word 7):   54  ← Top_imag
//   bottom[0] @ addr 32 (word 8):   32  ← Bottom_real
//   bottom[1] @ addr 36 (word 9):   46  ← Bottom_imag
// ============================================================================

.data x_k { 100, 50 }         // X[k] = (100, 50)
.data x_kL { 80, 40 }         // X[k+L] = (80, 40)
.data w { 181, -75 }          // W ≈ (0.707, -0.293) × 256

.data top { 0, 0 }            // Output: Top (real, imag)
.data bottom { 0, 0 }         // Output: Bottom (real, imag)

// Temporary storage for partial products
.data temp { 0, 0, 0, 0 }     // mul_rr, mul_ri, mul_ir, mul_ii

kernel "FFT_Butterfly_ComplexMul" {
    config(0xF, 0);

    // ========================================================================
    // PHASE 1: Load all inputs
    // ========================================================================
    
    // Load X[k] into R0, R1
    cycle { @0,0: LWI R0, x_k[0]; }      // R0 = 100 (X[k]_r)
    cycle { @0,0: LWI R1, x_k[1]; }      // R1 = 50  (X[k]_i)
    
    // Save X[k] to temp registers (we'll need them later)
    cycle { @0,0: SADD R2, R0, ZERO; }   // R2 = X[k]_r = 100 (backup)
    cycle { @0,0: SADD R3, R1, ZERO; }   // R3 = X[k]_i = 50 (backup)

    // ========================================================================
    // PHASE 2: Complex Multiplication - Product = X[k+L] × W
    // Using 4 partial products:
    //   mul_rr = X[kL]_r × W_r = 80 × 181 = 14480
    //   mul_ri = X[kL]_r × W_i = 80 × (-75) = -6000
    //   mul_ir = X[kL]_i × W_r = 40 × 181 = 7240
    //   mul_ii = X[kL]_i × W_i = 40 × (-75) = -3000
    // ========================================================================
    
    // Compute mul_rr = X[kL]_r × W_r
    cycle { @0,0: LWI R0, x_kL[0]; }     // R0 = 80
    cycle { @0,0: LWI R1, w[0]; }        // R1 = 181
    cycle { @0,0: SMUL R0, R0, R1; }     // R0 = 80 × 181 = 14480
    cycle { @0,0: SWI R0, temp[0]; }     // Save mul_rr
    
    // Compute mul_ii = X[kL]_i × W_i
    cycle { @0,0: LWI R0, x_kL[1]; }     // R0 = 40
    cycle { @0,0: LWI R1, w[1]; }        // R1 = -75
    cycle { @0,0: SMUL R0, R0, R1; }     // R0 = 40 × (-75) = -3000
    cycle { @0,0: SWI R0, temp[3]; }     // Save mul_ii
    
    // Compute mul_ri = X[kL]_r × W_i
    cycle { @0,0: LWI R0, x_kL[0]; }     // R0 = 80
    cycle { @0,0: LWI R1, w[1]; }        // R1 = -75
    cycle { @0,0: SMUL R0, R0, R1; }     // R0 = 80 × (-75) = -6000
    cycle { @0,0: SWI R0, temp[1]; }     // Save mul_ri
    
    // Compute mul_ir = X[kL]_i × W_r
    cycle { @0,0: LWI R0, x_kL[1]; }     // R0 = 40
    cycle { @0,0: LWI R1, w[0]; }        // R1 = 181
    cycle { @0,0: SMUL R0, R0, R1; }     // R0 = 40 × 181 = 7240
    cycle { @0,0: SWI R0, temp[2]; }     // Save mul_ir

    // ========================================================================
    // PHASE 3: Combine partial products
    //   Product_r = mul_rr - mul_ii = 14480 - (-3000) = 17480 → >>8 = 68
    //   Product_i = mul_ri + mul_ir = -6000 + 7240 = 1240 → >>8 = 4
    // ========================================================================
    
    // Product_r = mul_rr - mul_ii, then shift
    cycle { @0,0: LWI R0, temp[0]; }     // R0 = 14480 (mul_rr)
    cycle { @0,0: LWI R1, temp[3]; }     // R1 = -3000 (mul_ii)
    cycle { @0,0: SSUB R0, R0, R1; }     // R0 = 14480 - (-3000) = 17480
    cycle { @0,0: SRA R0, R0, IMM(8); }  // R0 = 17480 >> 8 = 68 (Product_r)
    cycle { @0,0: SADD R2, R0, ZERO; }   // R2 = Product_r = 68 (save)
    
    // Product_i = mul_ri + mul_ir, then shift
    cycle { @0,0: LWI R0, temp[1]; }     // R0 = -6000 (mul_ri)
    cycle { @0,0: LWI R1, temp[2]; }     // R1 = 7240 (mul_ir)
    cycle { @0,0: SADD R0, R0, R1; }     // R0 = -6000 + 7240 = 1240
    cycle { @0,0: SRA R0, R0, IMM(8); }  // R0 = 1240 >> 8 = 4 (Product_i)
    cycle { @0,0: SADD R3, R0, ZERO; }   // R3 = Product_i = 4 (save)

    // Now: R2 = Product_r = 68, R3 = Product_i = 4

    // ========================================================================
    // PHASE 4: Butterfly computation
    //   Top = X[k] + Product = (100+68, 50+4) = (168, 54)
    //   Bottom = X[k] - Product = (100-68, 50-4) = (32, 46)
    // ========================================================================
    
    // Reload X[k]
    cycle { @0,0: LWI R0, x_k[0]; }      // R0 = 100 (X[k]_r)
    cycle { @0,0: LWI R1, x_k[1]; }      // R1 = 50 (X[k]_i)
    
    // Top_r = X[k]_r + Product_r = 100 + 68 = 168
    cycle { @0,0: SADD R0, R0, R2; }     // R0 = 168
    cycle { @0,0: SWI R0, top[0]; }      // Store Top_r = 168
    
    // Reload X[k]_r for Bottom
    cycle { @0,0: LWI R0, x_k[0]; }      // R0 = 100
    
    // Bottom_r = X[k]_r - Product_r = 100 - 68 = 32
    cycle { @0,0: SSUB R0, R0, R2; }     // R0 = 32
    cycle { @0,0: SWI R0, bottom[0]; }   // Store Bottom_r = 32
    
    // Top_i = X[k]_i + Product_i = 50 + 4 = 54
    cycle { @0,0: SADD R1, R1, R3; }     // R1 = 54
    cycle { @0,0: SWI R1, top[1]; }      // Store Top_i = 54
    
    // Reload X[k]_i for Bottom
    cycle { @0,0: LWI R1, x_k[1]; }      // R1 = 50
    
    // Bottom_i = X[k]_i - Product_i = 50 - 4 = 46
    cycle { @0,0: SSUB R1, R1, R3; }     // R1 = 46
    cycle { @0,0: SWI R1, bottom[1]; }   // Store Bottom_i = 46

    cycle { @0,0: EXIT; }
}
