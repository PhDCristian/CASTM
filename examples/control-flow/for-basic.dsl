// Basic For Loop
//
// Demonstrates: for loop with range(n), compile-time unrolling,
//               loop variable substitution in IMM().

kernel "ForBasic" {
    config(0xF, 0);

    // Initialize accumulator
    cycle {
        @0,0: SADD R0, ZERO, ZERO;
    }

    // Unrolled loop: add 0, 1, 2, 3 to R0
    for i in range(4) {
        cycle {
            @0,0: SADD R0, R0, IMM(i);
        }
    }
    // After unrolling: R0 = 0 + 0 + 1 + 2 + 3 = 6

    cycle {
        @0,0: EXIT;
    }
}
