// Data Rotation
//
// Demonstrates: #pragma rotate, circular shift of register values across PEs.
// Each PE passes its value to the left neighbor, with wraparound.

kernel "Rotate" {
    config(0xF, 0);

    // Load different values into each PE
    bundle {
        @0,0: SADD R0, ZERO, 10;
        @0,1: SADD R0, ZERO, 20;
        @0,2: SADD R0, ZERO, 30;
        @0,3: SADD R0, ZERO, 40;
    }

    // Rotate R0 left by 1 position
    // Before: PE0=10, PE1=20, PE2=30, PE3=40
    // After:  PE0=20, PE1=30, PE2=40, PE3=10 (wraparound)
    #pragma rotate(reg=R0, direction=left)

    bundle {
        @0,0: EXIT;
    }
}
