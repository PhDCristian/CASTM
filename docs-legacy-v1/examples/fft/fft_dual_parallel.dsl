// FFT Radix-2: Dual Parallel Butterflies
// Based on: "Efficient and Flexible Implementation of FFT Application 
//           for CGRA Processor" (Yi et al., 2023)
//
// Key optimization from paper: Since only 20 PEs are needed per butterfly
// and the PEA has 64 PEs, two FFT computations can run in parallel.
//
// This kernel computes TWO butterfly operations simultaneously:
//   Set A (Rows 0-1): Top_A = X_A[k] + X_A[k+L] * W_A
//                     Bottom_A = X_A[k] - X_A[k+L] * W_A
//   Set B (Rows 2-3): Top_B = X_B[k] + X_B[k+L] * W_B
//                     Bottom_B = X_B[k] - X_B[k+L] * W_B
//
// Test case:
//   Set A: X[k]=1, X[k+L]=2, W=1 → Top=3, Bottom=-1
//   Set B: X[k]=5, X[k+L]=3, W=1 → Top=8, Bottom=2
//
// expect: memory[12]=3, memory[13]=-1, memory[18]=8, memory[19]=2

.data set_a { 1, 2, 1 }      // X[k], X[k+L], W for Set A
.data set_b { 5, 3, 1 }      // X[k], X[k+L], W for Set B
.data result_a { 0, 0 }      // Top, Bottom for Set A
.data result_b { 0, 0 }      // Top, Bottom for Set B

kernel "FFT_Dual_Parallel_Butterfly" {
    config(0xF, 0);

    // ========================================
    // PHASE 1: Load both sets in parallel
    // Row 0 (Cols 0-2): Set A inputs
    // Row 2 (Cols 0-2): Set B inputs
    // ========================================
    cycle {
        // Set A: X_A[k], X_A[k+L], W_A
        row 0: LWI R0, set_a[0] | LWI R0, set_a[1] | LWI R0, set_a[2] | _;
        // Set B: X_B[k], X_B[k+L], W_B
        row 2: LWI R0, set_b[0] | LWI R0, set_b[1] | LWI R0, set_b[2] | _;
    }
    
    // ========================================
    // PHASE 2: Parallel multiplication
    // Both sets compute X[k+L] * W simultaneously
    // ========================================
    
    // Output X[k+L] from Col 1 for both sets
    cycle {
        @0,1: SADD ROUT, R0, ZERO;  // Set A: output X_A[k+L]
        @2,1: SADD ROUT, R0, ZERO;  // Set B: output X_B[k+L]
    }
    
    // Multiply in Col 2 using RCL (receives from Col 1)
    cycle {
        @0,2: SMUL R1, R0, RCL;     // Set A: R1 = W_A * X_A[k+L] = 1*2 = 2
        @2,2: SMUL R1, R0, RCL;     // Set B: R1 = W_B * X_B[k+L] = 1*3 = 3
    }
    
    // ========================================
    // PHASE 3: Route products to Col 0
    // ========================================
    cycle {
        @0,2: SADD ROUT, R1, ZERO;  // Set A: output product
        @2,2: SADD ROUT, R1, ZERO;  // Set B: output product
    }
    cycle {
        @0,1: SADD ROUT, RCR, ZERO; // Set A: pass through
        @2,1: SADD ROUT, RCR, ZERO; // Set B: pass through
    }
    
    // ========================================
    // PHASE 4: Parallel butterfly computation
    // Row 0/1: Set A Top/Bottom
    // Row 2/3: Set B Top/Bottom
    // ========================================
    
    // Load X[k] into Row 1 and Row 3 for bottom calculations
    cycle {
        @1,0: LWI R0, set_a[0];     // Set A: X_A[k] for bottom
        @3,0: LWI R0, set_b[0];     // Set B: X_B[k] for bottom
    }
    
    // Recompute routing
    cycle {
        @0,2: SADD ROUT, R1, ZERO;
        @2,2: SADD ROUT, R1, ZERO;
    }
    cycle {
        @0,1: SADD ROUT, RCR, ZERO;
        @2,1: SADD ROUT, RCR, ZERO;
    }
    
    // Compute Top for both sets
    cycle {
        @0,0: SADD R1, R0, RCR;     // Top_A = 1 + 2 = 3
        @2,0: SADD R1, R0, RCR;     // Top_B = 5 + 3 = 8
    }
    
    // Re-route products for bottom
    cycle {
        @0,2: SADD ROUT, R1, ZERO;
        @2,2: SADD ROUT, R1, ZERO;
    }
    cycle {
        @0,1: SADD ROUT, RCR, ZERO;
        @2,1: SADD ROUT, RCR, ZERO;
    }
    
    // Compute Bottom for both sets
    cycle {
        @1,0: SSUB R2, R0, RCR;     // Bottom_A = 1 - 2 = -1
        @3,0: SSUB R2, R0, RCR;     // Bottom_B = 5 - 3 = 2
    }
    
    // ========================================
    // PHASE 5: Store all results in parallel
    // ========================================
    cycle {
        @0,0: SWI R1, result_a[0];  // Store Top_A = 3
        @1,0: SWI R2, result_a[1];  // Store Bottom_A = -1
        @2,0: SWI R1, result_b[0];  // Store Top_B = 8
        @3,0: SWI R2, result_b[1];  // Store Bottom_B = 2  
    }
    
    cycle {
        @0,0: EXIT;
    }
}
