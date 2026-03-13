// C-like Expression Syntax - Arithmetic Operations
//
// Demonstrates: register-level C-like expressions that desugar
//               to standard ISA instructions.
//
// R1 = R2 + R3   desugars to   SADD R1, R2, R3
// R0 = R1 - 5    desugars to   SSUB R0, R1, 5
// ROUT = R0 * R2 desugars to   SMUL ROUT, R0, R2
// R1 = R0 << 2   desugars to   SLT R1, R0, 2

kernel "CLikeArithmetic" {
    config(0xF, 0);

    // Bundle 0: Load initial values using assembly syntax
    bundle {
        @0,0: SADD R0, ZERO, 10;   // R0 = 10
        @0,1: SADD R0, ZERO, 20;   // R0 = 20
        @0,2: SADD R0, ZERO, 3;    // R0 = 3
        @0,3: SADD R0, ZERO, 7;    // R0 = 7
    }

    // Bundle 1: Arithmetic using C-like expressions
    bundle {
        @0,0: R1 = R0 + R0;       // R1 = 10 + 10 = 20
        @0,1: R1 = R0 - 5;        // R1 = 20 - 5 = 15
        @0,2: R1 = R0 * R0;       // R1 = 3 * 3 = 9
        @0,3: R1 = R0 << 2;       // R1 = 7 << 2 = 28
    }

    // Bundle 2: Bitwise using C-like expressions
    bundle {
        @0,0: R2 = R0 & 0xF;      // R2 = 10 & 0xF = 10
        @0,1: R2 = R0 ^ R1;       // R2 = 20 ^ 15 = 27
        @0,2: R2 = R0 >> 1;       // R2 = 3 >> 1 = 1
        @0,3: R2 = R1 >>> 1;      // R2 = 28 >>> 1 = 14
    }

    bundle { @0,0: EXIT; }
}
