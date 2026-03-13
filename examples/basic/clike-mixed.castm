// C-like Mixed Syntax - Assembly and Expressions Together
//
// Demonstrates: mixing standard assembly instructions with
//               C-like expression syntax in the same kernel.
//
// Assembly is used for: memory ops (LWI, SWI), control (EXIT)
// C-like is used for: arithmetic and bitwise operations

.data input { 5, 10, 15, 20 }
.data output 100 { 0, 0, 0, 0 }

kernel "MixedSyntax" {
    config(0xF, 0);

    // Bundle 0: Load from memory (assembly - LWI has no C-like equivalent)
    bundle {
        @0,0: LWI R0, input[0];
        @0,1: LWI R0, input[1];
        @0,2: LWI R0, input[2];
        @0,3: LWI R0, input[3];
    }

    // Bundle 1: Process with C-like expressions
    bundle {
        @0,0: R1 = R0 * R0;       // 5 * 5 = 25
        @0,1: R1 = R0 + R0;       // 10 + 10 = 20
        @0,2: R1 = R0 - 5;        // 15 - 5 = 10
        @0,3: R1 = R0 & 0xF;      // 20 & 0xF = 4
    }

    // Bundle 2: Store results (assembly)
    bundle {
        @0,0: SWI R1, output[0];
        @0,1: SWI R1, output[1];
        @0,2: SWI R1, output[2];
        @0,3: SWI R1, output[3];
    }

    bundle { @0,0: EXIT; }
}
