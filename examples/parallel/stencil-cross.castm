// Cross Stencil
//
// Demonstrates: #pragma stencil with cross pattern,
//               each PE accumulates values from its 4 neighbors.

kernel "StencilCross" {
    config(0xF, 0);

    // Initialize all PEs with different values
    bundle {
        @0,0: SADD R0, ZERO, 1;
        @0,1: SADD R0, ZERO, 2;
        @1,0: SADD R0, ZERO, 3;
        @1,1: SADD R0, ZERO, 4;
    }

    // Cross stencil: R1 = sum of R0 from N/S/E/W neighbors
    #pragma stencil(cross, add, R1, R0)

    bundle {
        @0,0: EXIT;
    }
}
