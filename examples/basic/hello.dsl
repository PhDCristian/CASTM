// Hello World - Minimal OpenEdge-DSL program
//
// Demonstrates: kernel declaration, config, cycle blocks,
//               @row,col coordinate syntax, EXIT instruction.
//
// This is the smallest valid program: a single PE executes EXIT.

kernel "Hello" {
    config(0xF, 0);

    cycle {
        @0,0: SADD R0, ZERO, 42;  // Load answer to life
    }

    cycle {
        @0,0: EXIT;
    }
}
