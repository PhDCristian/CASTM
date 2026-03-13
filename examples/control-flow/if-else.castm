// If-Else Conditional
//
// Demonstrates: if/else with runtime branching,
//               condition evaluation on a specific PE.

kernel "IfElse" {
    config(0xF, 0);

    // Set R0 = 5
    bundle {
        @0,0: SADD R0, ZERO, 5;
    }

    // If R0 == 5, set R1 = 1; else R1 = 0
    if (R0 == 5) @0,0 {
        bundle {
            @0,0: SADD R1, ZERO, 1;   // true branch
        }
    } else {
        bundle {
            @0,0: SADD R1, ZERO, 0;   // false branch
        }
    }

    bundle {
        @0,0: EXIT;
    }
}
