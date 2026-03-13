// While Loop
//
// Demonstrates: while loop with runtime branch,
//               labels and conditional branching.

kernel "WhileLoop" {
    config(0xF, 0);

    // Initialize counter R0 = 0
    bundle {
        @0,0: SADD R0, ZERO, ZERO;
    }

    // Count from 0 to 9
    while (R0 < 10) @0,0 {
        bundle {
            @0,0: SADD R0, R0, 1;
        }
    }
    // R0 = 10 after loop

    bundle {
        @0,0: EXIT;
    }
}
