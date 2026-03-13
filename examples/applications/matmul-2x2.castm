// 2x2 Matrix Multiplication
//
// Demonstrates: .data2d, nested loops, 2D array access,
//               accumulation across PEs.
// Computes C = A * B for 2x2 matrices.

.data2d A[2][2] { 1, 2, 3, 4 }
.data2d B[2][2] { 5, 6, 7, 8 }
.data2d C[2][2] { 0, 0, 0, 0 }

kernel "MatMul2x2" {
    config(0xF, 0);

    // For each element C[i][j] = sum_k(A[i][k] * B[k][j])
    for i in range(2) {
        for j in range(2) {
            // Initialize accumulator
            bundle {
                @0,0: SADD R3, ZERO, ZERO;
            }

            for k in range(2) {
                // Load A[i][k]
                bundle {
                    @0,0: LWI R0, A[i][k];
                }
                // Load B[k][j]
                bundle {
                    @0,0: LWI R1, B[k][j];
                }
                // Multiply and accumulate
                bundle {
                    @0,0: SMUL R2, R0, R1;
                }
                bundle {
                    @0,0: SADD R3, R3, R2;
                }
            }

            // Store C[i][j]
            bundle {
                @0,0: SWI R3, C[i][j];
            }
        }
    }

    bundle {
        @0,0: EXIT;
    }
}
