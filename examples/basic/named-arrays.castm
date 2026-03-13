// Named Arrays
//
// Demonstrates: .data directive with named arrays,
//               array indexing (name[i]), array properties (.len(), .base()).

.data input  { 10, 20, 30, 40 }
.data output { 0, 0, 0, 0 }

kernel "NamedArrays" {
    config(0xF, 0);

    // Load first and last elements
    bundle {
        @0,0: LWI R0, input[0];       // Load input[0] = 10
        @0,1: LWI R0, input[3];       // Load input[3] = 40
    }

    // Store results
    bundle {
        @0,0: SWI R0, output[0];
        @0,1: SWI R0, output[1];
    }

    bundle {
        @0,0: EXIT;
    }
}
