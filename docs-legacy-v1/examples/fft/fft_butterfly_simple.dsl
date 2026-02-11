// FFT Radix-2 Butterfly - Simplified Integer Version
// Based on: "Efficient and Flexible Implementation of FFT Application 
//           for CGRA Processor" (Yi et al., 2023)
//
// This kernel implements a single butterfly operation:
//   Top    = X[k] + X[k+L] * W
//   Bottom = X[k] - X[k+L] * W
//
// Test case: X[k]=2, X[k+L]=3, W=1
// Expected: Top=5, Bottom=-1
//
// expect: R1@0,0=5, R2@1,0=-1

.data values { 2, 3, 1 }  // X[k], X[k+L], W
.data result { 0, 0 }     // Top, Bottom output

kernel "FFT_Butterfly_Simple" {
    config(0xF, 0);

    // ========================================
    // PHASE 1: Load inputs in parallel
    // Col 0: X[k], Col 1: X[k+L], Col 2: W
    // ========================================
    cycle {
        row 0: LWI R0, values[0] | LWI R0, values[1] | LWI R0, values[2] | _;
    }
    
    // ========================================
    // PHASE 2: Multiply X[k+L] * W
    // Product computed in Col 1 using W from Col 2
    // ========================================
    
    // Route X[k+L] to be multiplied
    cycle {
        @0,1: SADD ROUT, R0, ZERO;  // Output X[k+L] for routing
    }
    
    // Multiply: Col 2 computes product using RCL (left neighbor = Col 1 output)
    cycle {
        @0,2: SMUL R1, R0, RCL;     // R1 = W * X[k+L] = 1 * 3 = 3
    }
    
    // ========================================
    // PHASE 3: Route product to Col 0
    // ========================================
    cycle {
        @0,2: SADD ROUT, R1, ZERO;  // Output product from Col 2
    }
    cycle {
        @0,1: SADD ROUT, RCR, ZERO; // Pass through Col 1
    }
    
    // ========================================
    // PHASE 4: Butterfly computation
    // Top = X[k] + product (in Row 0, Col 0)
    // Bottom = X[k] - product (in Row 1, Col 0)
    // ========================================
    
    // First load X[k] into Row 1 as well
    cycle {
        @1,0: LWI R0, values[0];    // Load X[k] into Row 1
    }
    
    // Recompute routing for butterfly
    cycle {
        @0,2: SADD ROUT, R1, ZERO;
    }
    cycle {
        @0,1: SADD ROUT, RCR, ZERO;
    }
    
    // Compute both branches
    cycle {
        @0,0: SADD R1, R0, RCR;     // Top = X[k] + product = 2 + 3 = 5
    }
    cycle {
        @0,2: SADD ROUT, R1, ZERO;  // Re-route product
    }
    cycle {
        @0,1: SADD ROUT, RCR, ZERO;
    }
    cycle {
        @1,0: SSUB R2, R0, RCR;     // Bottom = X[k] - product = 2 - 3 = -1
    }
    
    // ========================================
    // PHASE 5: Store results
    // ========================================
    cycle {
        @0,0: SWI R1, result[0];    // Store Top = 5
    }
    cycle {
        @1,0: SWI R2, result[1];    // Store Bottom = -1
    }
    
    // ========================================
    // Assertions for verification
    // ========================================
    cycle {
        @0,0: ASSERT R1: 5;         // Verify Top = 5
    }
    cycle {
        @1,0: ASSERT R2: -1;        // Verify Bottom = -1
    }
    
    cycle {
        @0,0: EXIT;
    }
}
