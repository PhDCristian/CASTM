// Simple OpenEdge-DSL Example
// Basic add test

.data input { 10, 20 }
.data output { 0 }

kernel "SimpleAdd" {
    config(0xF, 0);
    
    // Load and add two values
    cycle {
        @0,0: LWI R0, input[0];
        @0,1: LWI R0, input[1];
    }
    
    // Route value from col 1 to col 0
    cycle {
        @0,1: SADD ROUT, R0, ZERO;
        @0,0: SADD R0, ROUT, ZERO;
    }
    
    // Add the values
    cycle {
        @0,0: SADD R1, R0, RCR;  // R1 = 10 + 20 = 30
    }
    
    // Store result
    cycle {
        @0,0: SWI R1, output[0];
    }
    
    cycle {
        @0,0: EXIT;
    }
}
