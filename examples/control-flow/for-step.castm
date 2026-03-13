// For Loop with Start, End, Step
//
// Demonstrates: range(start, end) and range(start, end, step),
//               loop variable used in array indexing.

.data values { 100, 200, 300, 400, 500, 600, 700, 800 }

kernel "ForStep" {
    config(0xF, 0);

    // Load every other value: values[0], values[2], values[4], values[6]
    for i in range(0, 8, 2) {
        bundle {
            @0,0: LWI R0, values[i];
        }
    }

    bundle {
        @0,0: EXIT;
    }
}
