// Broadcast
//
// Demonstrates: #pragma broadcast, sending a value from one PE
//               to all PEs in the same row.

kernel "Broadcast" {
    config(0xF, 0);

    // Load value at PE(0,0) only
    bundle {
        @0,0: SADD R0, ZERO, 99;
    }

    // Broadcast R0 from PE(0,0) to all PEs in the row
    #pragma broadcast(value=R0, from=@0,0, to=row)
    // After: all PEs in row 0 receive the value

    bundle {
        @0,0: EXIT;
    }
}
