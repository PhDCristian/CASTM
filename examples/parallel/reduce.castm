// Reduction (Sum)
//
// Demonstrates: #pragma reduce, summing values across PEs
//               using neighbor communication in a tree pattern.

kernel "Reduce" {
    config(0xF, 0);

    // Load values into each PE of row 0
    bundle {
        @0,0: SADD R0, ZERO, 10;
        @0,1: SADD R0, ZERO, 20;
        @0,2: SADD R0, ZERO, 30;
        @0,3: SADD R0, ZERO, 40;
    }

    // Reduce: sum all R0 values into R1
    #pragma reduce(sum, R1, R0)
    // After: PE(0,0).R1 = 10+20+30+40 = 100

    bundle {
        @0,0: EXIT;
    }
}
