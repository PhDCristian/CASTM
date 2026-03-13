// Constants and Aliases
//
// Demonstrates: .const directive, .alias directive,
//               constant references with dot prefix (.NAME) and direct name.

.const THRESHOLD 100
.const STEP 4

.alias counter R0
.alias value   R1

kernel "Constants" {
    config(0xF, 0);

    // Initialize counter to 0
    bundle {
        @0,0: SADD counter, ZERO, ZERO;
    }

    // Load threshold into value register
    bundle {
        @0,0: SADD value, ZERO, .THRESHOLD;
    }

    // Add step to counter
    bundle {
        @0,0: SADD counter, counter, STEP;
    }

    bundle {
        @0,0: EXIT;
    }
}
