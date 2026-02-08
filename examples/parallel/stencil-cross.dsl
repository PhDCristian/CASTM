// Cross Stencil
//
// Demonstrates: #pragma stencil with cross pattern,
//               each PE accumulates values from its 4 neighbors.

kernel "StencilCross" {
    config(0xF, 0);

    // Initialize all PEs with different values
    cycle {
        @0,0: SADD R0, ZERO, IMM(1);
        @0,1: SADD R0, ZERO, IMM(2);
        @1,0: SADD R0, ZERO, IMM(3);
        @1,1: SADD R0, ZERO, IMM(4);
    }

    // Cross stencil: R1 = sum of R0 from N/S/E/W neighbors
    #pragma stencil(cross, add, R1, R0)

    cycle {
        @0,0: EXIT;
    }
}
