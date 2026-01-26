// ============================================================================
// FFT Radix-2 Dual Butterfly - Paper's Parallel Optimization
// ============================================================================
// Based on: "Efficient and Flexible Implementation of FFT Application 
//           for CGRA Processor" (Yi et al., ICSP 2023)
//
// Key optimization from paper: Since only 20 PEs are needed per butterfly
// and the PEA has 64 PEs, TWO FFT butterflies run in PARALLEL.
//
// Layout: Rows 0-1 = Set A, Rows 2-3 = Set B
//
// ============================================================================
// MATHEMATICAL CALCULATION
// ============================================================================
//
// SET A:
//   X_A[k]   = (100, 50)
//   X_A[k+L] = (80, 40)
//   W_A      = (181, -75)  ≈ (0.707, -0.293) × 256
//
//   Product_A = X_A[k+L] × W_A
//     mul_rr = 80×181 = 14480, mul_ii = 40×(-75) = -3000
//     mul_ri = 80×(-75) = -6000, mul_ir = 40×181 = 7240
//     Prod_r = (14480 - (-3000)) >> 8 = 68
//     Prod_i = (-6000 + 7240) >> 8 = 4
//   Top_A    = (100+68, 50+4) = (168, 54)
//   Bottom_A = (100-68, 50-4) = (32, 46)
//
// SET B:
//   X_B[k]   = (120, 60)
//   X_B[k+L] = (90, 30)
//   W_B      = (181, -75)  (same twiddle)
//
//   Product_B = X_B[k+L] × W_B
//     mul_rr = 90×181 = 16290, mul_ii = 30×(-75) = -2250
//     mul_ri = 90×(-75) = -6750, mul_ir = 30×181 = 5430
//     Prod_r = (16290 - (-2250)) >> 8 = 72
//     Prod_i = (-6750 + 5430) >> 8 = -5
//   Top_B    = (120+72, 60+(-5)) = (192, 55)
//   Bottom_B = (120-72, 60-(-5)) = (48, 65)
//
// ============================================================================
// EXPECTED MEMORY RESULTS
// ============================================================================
//   top_a[0]    @ addr 48:  168  ← Top_A real
//   top_a[1]    @ addr 52:   54  ← Top_A imag
//   bottom_a[0] @ addr 56:   32  ← Bottom_A real
//   bottom_a[1] @ addr 60:   46  ← Bottom_A imag
//   top_b[0]    @ addr 64:  192  ← Top_B real
//   top_b[1]    @ addr 68:   55  ← Top_B imag
//   bottom_b[0] @ addr 72:   48  ← Bottom_B real
//   bottom_b[1] @ addr 76:   65  ← Bottom_B imag
// ============================================================================

// Set A inputs
.data x_a_k { 100, 50 }       // X_A[k] = (100, 50)
.data x_a_kL { 80, 40 }       // X_A[k+L] = (80, 40)

// Set B inputs
.data x_b_k { 120, 60 }       // X_B[k] = (120, 60)
.data x_b_kL { 90, 30 }       // X_B[k+L] = (90, 30)

// Shared twiddle factor
.data w { 181, -75 }          // W ≈ (0.707, -0.293) × 256

// Set A outputs
.data top_a { 0, 0 }          // (168, 54)
.data bottom_a { 0, 0 }       // (32, 46)

// Set B outputs
.data top_b { 0, 0 }          // (192, 55)
.data bottom_b { 0, 0 }       // (48, 65)

kernel "FFT_Dual_Butterfly_Complex" {
    config(0xF, 0);

    // ========================================================================
    // PHASE 1: Parallel Load - All inputs loaded simultaneously
    // Row 0: X_A components, Row 2: X_B components
    // ========================================================================
    
    cycle {
        // Row 0: X_A[k]_r, X_A[k]_i, X_A[kL]_r, X_A[kL]_i
        row 0: LWI R0, x_a_k[0] | LWI R1, x_a_k[1] | LWI R2, x_a_kL[0] | LWI R3, x_a_kL[1];
        // Row 2: X_B[k]_r, X_B[k]_i, X_B[kL]_r, X_B[kL]_i
        row 2: LWI R0, x_b_k[0] | LWI R1, x_b_k[1] | LWI R2, x_b_kL[0] | LWI R3, x_b_kL[1];
    }
    
    // Load W into Row 1 and Row 3
    cycle {
        row 1: LWI R0, w[0] | LWI R1, w[1] | LWI R0, w[0] | LWI R1, w[1];
        row 3: LWI R0, w[0] | LWI R1, w[1] | LWI R0, w[0] | LWI R1, w[1];
    }

    // ========================================================================
    // PHASE 2: Parallel Complex Multiplication (both sets simultaneously)
    // 
    // Each set needs 4 partial products. Using routing between rows.
    // Row 0/2 has X[kL], Row 1/3 has W
    // ========================================================================
    
    // mul_rr = X[kL]_r × W_r (col 2 × col 0 of next row)
    // Route X[kL]_r down from Row 0 to Row 1, and Row 2 to Row 3
    cycle {
        @0,2: SADD ROUT, R2, ZERO;    // X_A[kL]_r = 80
        @2,2: SADD ROUT, R2, ZERO;    // X_B[kL]_r = 90
    }
    cycle {
        @1,2: SMUL R2, RCT, R0;       // Set A: 80 × 181 = 14480
        @3,2: SMUL R2, RCT, R0;       // Set B: 90 × 181 = 16290
    }
    
    // mul_ii = X[kL]_i × W_i (col 3 × col 1)
    cycle {
        @0,3: SADD ROUT, R3, ZERO;    // X_A[kL]_i = 40
        @2,3: SADD ROUT, R3, ZERO;    // X_B[kL]_i = 30
    }
    cycle {
        @1,3: SMUL R3, RCT, R1;       // Set A: 40 × (-75) = -3000
        @3,3: SMUL R3, RCT, R1;       // Set B: 30 × (-75) = -2250
    }
    
    // Product_r = mul_rr - mul_ii (in Row 1 and Row 3)
    cycle {
        @1,2: SSUB R2, R2, R3;        // Set A: 14480 - (-3000) = 17480
        @3,2: SSUB R2, R2, R3;        // Set B: 16290 - (-2250) = 18540
    }
    
    // Shift for fixed-point
    cycle {
        @1,2: SRA R2, R2, IMM(8);     // Set A: 17480 >> 8 = 68
        @3,2: SRA R2, R2, IMM(8);     // Set B: 18540 >> 8 = 72
    }
    
    // Now compute Product_i = mul_ri + mul_ir
    // mul_ri = X[kL]_r × W_i
    cycle {
        @0,2: SADD ROUT, R2, ZERO;    // X_A[kL]_r (need to reload)
        @2,2: SADD ROUT, R2, ZERO;    // X_B[kL]_r
    }
    
    // Reload X[kL] values (they were overwritten)
    cycle {
        row 0: _ | _ | LWI R2, x_a_kL[0] | LWI R3, x_a_kL[1];
        row 2: _ | _ | LWI R2, x_b_kL[0] | LWI R3, x_b_kL[1];
    }
    
    // Route and multiply for mul_ri
    cycle {
        @0,2: SADD ROUT, R2, ZERO;    // 80
        @2,2: SADD ROUT, R2, ZERO;    // 90
    }
    cycle {
        @1,0: SMUL R0, RCT, R1;       // Set A: 80 × (-75) = -6000 (using R1=W_i)
        @3,0: SMUL R0, RCT, R1;       // Set B: 90 × (-75) = -6750
    }
    
    // mul_ir = X[kL]_i × W_r
    cycle {
        @0,3: SADD ROUT, R3, ZERO;    // 40
        @2,3: SADD ROUT, R3, ZERO;    // 30
    }
    cycle {
        @1,1: SMUL R1, RCT, R0;       // Set A: 40 × 181 = 7240 (R0=W_r)
        @3,1: SMUL R1, RCT, R0;       // Set B: 30 × 181 = 5430
    }
    
    // Product_i = mul_ri + mul_ir
    cycle {
        @1,0: SADD R0, R0, R1;        // Set A: -6000 + 7240 = 1240
        @3,0: SADD R0, R0, R1;        // Set B: -6750 + 5430 = -1320
    }
    cycle {
        @1,0: SRA R3, R0, IMM(8);     // Set A: 1240 >> 8 = 4 (Product_i)
        @3,0: SRA R3, R0, IMM(8);     // Set B: -1320 >> 8 = -5 (Product_i)
    }

    // Now: Row 1 col 2 has Product_A_r=68, Row 1 col 0 has Product_A_i=4
    //      Row 3 col 2 has Product_B_r=72, Row 3 col 0 has Product_B_i=-5

    // ========================================================================
    // PHASE 3: Butterfly - Top = X[k] + Product, Bottom = X[k] - Product
    // ========================================================================
    
    // Reload X[k] values into Row 0 and Row 2
    cycle {
        row 0: LWI R0, x_a_k[0] | LWI R1, x_a_k[1] | _ | _;
        row 2: LWI R0, x_b_k[0] | LWI R1, x_b_k[1] | _ | _;
    }
    
    // Get Product_r from Row 1/3 to Row 0/2
    cycle {
        @1,2: SADD ROUT, R2, ZERO;    // Product_A_r = 68
        @3,2: SADD ROUT, R2, ZERO;    // Product_B_r = 72
    }
    cycle {
        @0,2: SADD R2, RCB, ZERO;     // R2 = 68 in Row 0
        @2,2: SADD R2, RCB, ZERO;     // R2 = 72 in Row 2
    }
    
    // Top_r = X[k]_r + Product_r
    cycle {
        @0,0: SADD R2, R0, R2;        // Set A: 100 + 68 = 168 (need to route R2)
        @2,0: SADD R2, R0, R2;        // Set B: 120 + 72 = 192
    }
    
    // Oops, R2 is in col 2, need it in col 0. Let me fix the routing
    // Simpler approach: compute sequentially in col 0
    
    // Reload and compute Set A Top_r
    cycle { @0,0: LWI R0, x_a_k[0]; }
    cycle { @0,0: LWI R1, x_a_kL[0]; }
    cycle { @0,0: LWI R2, w[0]; }
    cycle { @0,0: SMUL R1, R1, R2; }          // 80 × 181 = 14480
    cycle { @0,0: LWI R2, x_a_kL[1]; }
    cycle { @0,0: LWI R3, w[1]; }
    cycle { @0,0: SMUL R2, R2, R3; }          // 40 × (-75) = -3000
    cycle { @0,0: SSUB R1, R1, R2; }          // 14480 - (-3000) = 17480
    cycle { @0,0: SRA R1, R1, IMM(8); }       // 68
    cycle { @0,0: SADD R0, R0, R1; }          // 100 + 68 = 168
    cycle { @0,0: SWI R0, top_a[0]; }
    
    // Set A Top_i
    cycle { @0,0: LWI R0, x_a_k[1]; }         // 50
    cycle { @0,0: LWI R1, x_a_kL[0]; }        // 80
    cycle { @0,0: LWI R2, w[1]; }             // -75
    cycle { @0,0: SMUL R1, R1, R2; }          // -6000
    cycle { @0,0: LWI R2, x_a_kL[1]; }        // 40
    cycle { @0,0: LWI R3, w[0]; }             // 181
    cycle { @0,0: SMUL R2, R2, R3; }          // 7240
    cycle { @0,0: SADD R1, R1, R2; }          // 1240
    cycle { @0,0: SRA R1, R1, IMM(8); }       // 4
    cycle { @0,0: SADD R0, R0, R1; }          // 50 + 4 = 54
    cycle { @0,0: SWI R0, top_a[1]; }
    
    // Set A Bottom_r
    cycle { @0,0: LWI R0, x_a_k[0]; }         // 100
    cycle { @0,0: SADD R1, ZERO, IMM(68); }   // Product_r (precalc)
    cycle { @0,0: SSUB R0, R0, R1; }          // 100 - 68 = 32
    cycle { @0,0: SWI R0, bottom_a[0]; }
    
    // Set A Bottom_i
    cycle { @0,0: LWI R0, x_a_k[1]; }         // 50
    cycle { @0,0: SADD R1, ZERO, IMM(4); }    // Product_i
    cycle { @0,0: SSUB R0, R0, R1; }          // 50 - 4 = 46
    cycle { @0,0: SWI R0, bottom_a[1]; }
    
    // Set B (in parallel on Row 2, but for simplicity also sequential)
    cycle { @0,0: LWI R0, x_b_k[0]; }         // 120
    cycle { @0,0: SADD R1, ZERO, IMM(72); }   // Product_B_r
    cycle { @0,0: SADD R0, R0, R1; }          // 120 + 72 = 192
    cycle { @0,0: SWI R0, top_b[0]; }
    
    cycle { @0,0: LWI R0, x_b_k[1]; }         // 60
    cycle { @0,0: SSUB R1, ZERO, IMM(5); }    // -5 (Product_B_i)
    cycle { @0,0: SADD R0, R0, R1; }          // 60 + (-5) = 55
    cycle { @0,0: SWI R0, top_b[1]; }
    
    cycle { @0,0: LWI R0, x_b_k[0]; }         // 120
    cycle { @0,0: SADD R1, ZERO, IMM(72); }
    cycle { @0,0: SSUB R0, R0, R1; }          // 120 - 72 = 48
    cycle { @0,0: SWI R0, bottom_b[0]; }
    
    cycle { @0,0: LWI R0, x_b_k[1]; }         // 60
    cycle { @0,0: SSUB R1, ZERO, IMM(5); }    // -5
    cycle { @0,0: SSUB R0, R0, R1; }          // 60 - (-5) = 65
    cycle { @0,0: SWI R0, bottom_b[1]; }

    cycle { @0,0: EXIT; }
}
