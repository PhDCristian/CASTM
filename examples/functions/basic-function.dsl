// Basic Function
//
// Demonstrates: function definition, function call with inline expansion,
//               parameter substitution.

// Function to initialize a register with an immediate value
function init_reg(reg, val) {
    bundle {
        @0,0: SADD reg, ZERO, val;
    }
}

kernel "BasicFunction" {
    config(0xF, 0);

    // Call the function with different arguments
    init_reg(R0, 10);   // Expands to: SADD R0, ZERO, 10
    init_reg(R1, 20);   // Expands to: SADD R1, ZERO, 20
    init_reg(R2, 30);   // Expands to: SADD R2, ZERO, 30

    // Use the initialized values
    bundle {
        @0,0: SADD R3, R0, R1;   // R3 = 10 + 20 = 30
    }

    bundle {
        @0,0: EXIT;
    }
}
