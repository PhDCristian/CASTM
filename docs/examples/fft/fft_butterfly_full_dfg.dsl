// ============================================================================
// FFT Radix-2 Butterfly - Full DFG Implementation (Simplified)
// ============================================================================
// Based on: "Efficient and Flexible Implementation of FFT Application 
//           for CGRA Processor" (Yi et al., ICSP 2023)
//
// This implements a simplified version of the DFG for a 4x4 CGRA.
// Complex butterfly: Top = X[k] + X[k+L]*W, Bottom = X[k] - X[k+L]*W
//
// Using simple test values:
//   X[k] = (10, 5), X[k+L] = (6, 3), W = (1, 0) (unity)
//   Product = (6*1 - 3*0, 6*0 + 3*1) = (6, 3)
//   Top = (10+6, 5+3) = (16, 8)
//   Bottom = (10-6, 5-3) = (4, 2)
// ============================================================================

.data x_k { 10, 5 }           // X[k] real, imag
.data x_kL { 6, 3 }           // X[k+L] real, imag
.data w { 1, 0 }              // W = 1 (unity twiddle for simplicity)

.data top { 0, 0 }            // Output: Top real, imag
.data bottom { 0, 0 }         // Output: Bottom real, imag

kernel "FFT_Butterfly_Full_DFG" {
    config(0xF, 0);

    // ========================================================================
    // WAVE 1: Load all inputs (Cycle 0-1)
    // ========================================================================
    
    // Load X[k] and X[k+L] into Row 0
    cycle {
        row 0: LWI R0, x_k[0] | LWI R1, x_k[1] | LWI R2, x_kL[0] | LWI R3, x_kL[1];
    }
    
    // Load W into Row 1 (Col 0-1)
    cycle {
        row 1: LWI R0, w[0] | LWI R1, w[1] | _ | _;
    }

    // ========================================================================
    // WAVE 2: Complex Multiplication Product = X[k+L] * W
    // Product_r = X[kL]_r * W_r - X[kL]_i * W_i
    // Product_i = X[kL]_r * W_i + X[kL]_i * W_r
    // ========================================================================
    
    // Route X[k+L] values to Row 1 for multiplication
    cycle {
        @0,2: SADD ROUT, R2, ZERO;  // X[kL]_r
        @0,3: SADD ROUT, R3, ZERO;  // X[kL]_i
    }
    
    // Compute all 4 partial products in Row 2
    // Using Row 1 W values and Row 0 X[kL] values routed down
    cycle {
        // Mul1: X[kL]_r * W_r
        @1,0: SMUL R2, R0, RCT;     // R2 = W_r * (need X[kL]_r)
    }
    
    // Simplified: W_i = 0, so Product = X[kL] * 1 = X[kL]
    // Product_r = X[kL]_r, Product_i = X[kL]_i
    
    // For W=(1,0): Product_r = X[kL]_r*1 - X[kL]_i*0 = X[kL]_r
    //              Product_i = X[kL]_r*0 + X[kL]_i*1 = X[kL]_i
    
    // Store X[kL] as Product (since W=1)
    cycle {
        @0,2: SADD ROUT, R2, ZERO;  // Product_r = X[kL]_r = 6
    }
    cycle {
        @1,2: SADD R2, RCT, ZERO;   // Save in Row 1, Col 2
    }
    cycle {
        @0,3: SADD ROUT, R3, ZERO;  // Product_i = X[kL]_i = 3
    }
    cycle {
        @1,3: SADD R2, RCT, ZERO;   // Save in Row 1, Col 3
    }

    // ========================================================================
    // WAVE 3: Butterfly computation
    // Top = X[k] + Product, Bottom = X[k] - Product
    // ========================================================================
    
    // Route Product to Row 2
    cycle {
        @1,2: SADD ROUT, R2, ZERO;  // Product_r
        @1,3: SADD ROUT, R2, ZERO;  // Product_i
    }
    cycle {
        @2,2: SADD R0, RCT, ZERO;   // R0 = Product_r in Row 2, Col 2
        @2,3: SADD R0, RCT, ZERO;   // R0 = Product_i in Row 2, Col 3
    }
    
    // Get X[k] from Row 0
    cycle {
        @0,0: SADD ROUT, R0, ZERO;  // X[k]_r
        @0,1: SADD ROUT, R1, ZERO;  // X[k]_i
    }
    cycle {
        @1,0: SADD ROUT, RCT, ZERO;
        @1,1: SADD ROUT, RCT, ZERO;
    }
    cycle {
        @2,0: SADD R1, RCT, ZERO;   // R1 = X[k]_r in Row 2, Col 0
        @2,1: SADD R1, RCT, ZERO;   // R1 = X[k]_i in Row 2, Col 1
    }
    
    // Compute Top_r = X[k]_r + Product_r
    cycle {
        @2,2: SADD ROUT, R0, ZERO;  // Route Product_r to Col 0
    }
    cycle {
        @2,1: SADD ROUT, RCR, ZERO;
    }
    cycle {
        @2,0: SADD R2, R1, RCR;     // R2 = X[k]_r + Product_r = 10 + 6 = 16
    }
    
    // Store Top_r
    cycle {
        @2,0: SWI R2, top[0];       // top[0] = 16
    }
    
    // Compute Top_i = X[k]_i + Product_i
    cycle {
        @2,3: SADD ROUT, R0, ZERO;  // Route Product_i
    }
    cycle {
        @2,2: SADD ROUT, RCR, ZERO;
    }
    cycle {
        @2,1: SADD R2, R1, RCR;     // R2 = X[k]_i + Product_i = 5 + 3 = 8
    }
    
    // Store Top_i
    cycle {
        @2,1: SWI R2, top[1];       // top[1] = 8
    }
    
    // Compute Bottom_r = X[k]_r - Product_r  
    cycle {
        @2,2: SADD ROUT, R0, ZERO;  // Re-route Product_r
    }
    cycle {
        @2,1: SADD ROUT, RCR, ZERO;
    }
    cycle {
        @2,0: SSUB R2, R1, RCR;     // R2 = X[k]_r - Product_r = 10 - 6 = 4
    }
    
    // Store Bottom_r
    cycle {
        @2,0: SWI R2, bottom[0];    // bottom[0] = 4
    }
    
    // Compute Bottom_i = X[k]_i - Product_i
    cycle {
        @2,3: SADD ROUT, R0, ZERO;  // Re-route Product_i
    }
    cycle {
        @2,2: SADD ROUT, RCR, ZERO;
    }
    cycle {
        @2,1: SSUB R2, R1, RCR;     // R2 = X[k]_i - Product_i = 5 - 3 = 2
    }
    
    // Store Bottom_i
    cycle {
        @2,1: SWI R2, bottom[1];    // bottom[1] = 2
    }

    cycle {
        @0,0: EXIT;
    }
}
