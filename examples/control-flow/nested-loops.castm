// Nested For Loops
//
// Demonstrates: nested for loops, both loop variables
//               used in expressions.

kernel "NestedLoops" {
    config(0xF, 0);

    // 2x2 iteration: (i,j) = (0,0), (0,1), (1,0), (1,1)
    for i in range(2) {
        for j in range(2) {
            bundle {
                // Load i and j into separate registers
                @0,0: SADD R0, ZERO, i;
                @0,1: SADD R0, ZERO, j;
            }
        }
    }

    bundle {
        @0,0: EXIT;
    }
}
