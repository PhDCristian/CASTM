// Prefix Scan
//
// Demonstrates: #pragma scan, computing prefix sums across PEs.
// Each PE gets the cumulative sum of all PEs to its left (inclusive).

kernel "Scan" {
    config(0xF, 0);

    // Load values into row 0
    bundle {
        @0,0: SADD R0, ZERO, 1;
        @0,1: SADD R0, ZERO, 2;
        @0,2: SADD R0, ZERO, 3;
        @0,3: SADD R0, ZERO, 4;
    }

    // Prefix sum: scan right with add operation
    #pragma scan(add, R1, R0, right)
    // After: PE(0,0).R1=1, PE(0,1).R1=3, PE(0,2).R1=6, PE(0,3).R1=10

    bundle {
        @0,0: EXIT;
    }
}
