// Data Shift
//
// Demonstrates: #pragma shift, linear shift with fill value.
// Values move right, leftmost PE gets fill value (0).

kernel "Shift" {
    config(0xF, 0);

    // Load different values into each PE
    bundle {
        @0,0: SADD R0, ZERO, 10;
        @0,1: SADD R0, ZERO, 20;
        @0,2: SADD R0, ZERO, 30;
        @0,3: SADD R0, ZERO, 40;
    }

    // Shift R0 right by 1 position, fill with 0
    // Before: PE0=10, PE1=20, PE2=30, PE3=40
    // After:  PE0=0,  PE1=10, PE2=20, PE3=30
    #pragma shift(reg=R0, direction=right, distance=1, fill=0)

    bundle {
        @0,0: EXIT;
    }
}
