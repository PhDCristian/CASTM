// Data Routing
//
// Demonstrates: #pragma route, moving data between non-adjacent PEs
//               with payload and accumulator registers.

kernel "Route" {
    config(0xF, 0);

    // Load value at PE(0,0)
    bundle {
        @0,0: SADD R0, ZERO, 42;
    }

    // Route value from PE(0,0) to PE(0,2)
    // payload(R0): the register carrying the data
    // accum(R1): the destination register at PE(0,2)
    #pragma route (0,0) -> (0,2) payload(R0) accum(R1)

    bundle {
        @0,0: EXIT;
    }
}
