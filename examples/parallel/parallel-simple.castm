// Simple Parallel Distribution
//
// Demonstrates: #pragma parallel, distributing work across PEs.
// Each PE in the same row gets a different iteration.

kernel "ParallelSimple" {
    config(0xF, 0);

    // Distribute i=0..3 across columns 0..3
    #pragma parallel
    for i in range(4) {
        bundle {
            @0,i: SADD R0, ZERO, i;
        }
    }
    // After: PE(0,0).R0=0, PE(0,1).R0=1, PE(0,2).R0=2, PE(0,3).R0=3

    bundle {
        @0,0: EXIT;
    }
}
