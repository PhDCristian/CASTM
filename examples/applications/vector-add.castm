// Vector Addition
//
// Demonstrates: element-wise vector addition using parallel PEs.
// Each PE loads one element from A and B, computes A[i]+B[i].

.data A { 10, 20, 30, 40 }
.data B { 1, 2, 3, 4 }
.data C { 0, 0, 0, 0 }

kernel "VectorAdd" {
    config(0xF, 0);

    // Load A[i] and B[i] in parallel across 4 PEs
    #pragma parallel
    for i in range(4) {
        bundle {
            @0,i: LWI R0, A[i];
        }
    }

    #pragma parallel
    for i in range(4) {
        bundle {
            @0,i: LWI R1, B[i];
        }
    }

    // Compute C[i] = A[i] + B[i]
    #pragma parallel
    for i in range(4) {
        bundle {
            @0,i: SADD R2, R0, R1;
        }
    }

    // Store results
    #pragma parallel
    for i in range(4) {
        bundle {
            @0,i: SWI R2, C[i];
        }
    }

    bundle {
        @0,0: EXIT;
    }
}
