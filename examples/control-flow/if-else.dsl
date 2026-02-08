// If-Else Conditional
//
// Demonstrates: if/else with runtime branching,
//               condition evaluation on a specific PE.

kernel "IfElse" {
    config(0xF, 0);

    // Set R0 = 5
    cycle {
        @0,0: SADD R0, ZERO, IMM(5);
    }

    // If R0 == 5, set R1 = 1; else R1 = 0
    if (R0 == IMM(5)) @0,0 {
        cycle {
            @0,0: SADD R1, ZERO, IMM(1);   // true branch
        }
    } else {
        cycle {
            @0,0: SADD R1, ZERO, IMM(0);   // false branch
        }
    }

    cycle {
        @0,0: EXIT;
    }
}
