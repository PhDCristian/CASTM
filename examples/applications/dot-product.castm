// Dot Product
//
// Demonstrates: parallel multiply, reduction to sum partial products.
// dot = sum(A[i] * B[i]) for i=0..3

.data A { 1, 2, 3, 4 }
.data B { 5, 6, 7, 8 }

kernel "DotProduct" {
    config(0xF, 0);

    // Load A[i] into each PE
    #pragma parallel
    for i in range(4) {
        bundle {
            @0,i: LWI R0, A[i];
        }
    }

    // Load B[i] into each PE
    #pragma parallel
    for i in range(4) {
        bundle {
            @0,i: LWI R1, B[i];
        }
    }

    // Multiply: R2 = A[i] * B[i]
    bundle {
        @0,0: SMUL R2, R0, R1;
        @0,1: SMUL R2, R0, R1;
        @0,2: SMUL R2, R0, R1;
        @0,3: SMUL R2, R0, R1;
    }

    // Reduce: sum all R2 values into R3
    #pragma reduce(sum, R3, R2)
    // Result: R3 at PE(0,0) = 1*5 + 2*6 + 3*7 + 4*8 = 5+12+21+32 = 70

    bundle {
        @0,0: EXIT;
    }
}
