# Error Codes Reference

[← Specification](../spec/05-compilation.md) | [Index](../README.md)

## Overview

OpenEdgeDSL uses a structured error code system to help developers quickly identify and resolve compilation issues. Error codes are prefixed with:

- **E** for errors (compilation-blocking issues)
- **W** for warnings (potential issues that don't prevent compilation)

Codes are organized by compilation phase:
- **E1xxx**: Lexer errors (tokenization)
- **E2xxx**: Parser errors (syntax analysis)
- **E3xxx**: Semantic errors (validation)
- **E4xxx**: Code generation errors
- **W5xxx**: Warnings

---

## Lexer Errors (E1xxx)

Lexer errors occur during the tokenization phase when the compiler encounters invalid characters or malformed tokens.

### E1001: UNEXPECTED_CHARACTER

**Description**: The lexer encountered a character that is not valid in the DSL syntax.

**Causes**:
- Special characters not used in OpenEdgeDSL
- Invalid Unicode characters
- Accidental copy-paste of non-text characters

**Example**:
```dsl
kernel "Test" {
    config(0xF, 0);

    cycle {
        @0,0: SADD R0, ZERO, IMM(42) § invalid;  // § is not valid
    }
}
```

**How to Fix**: Remove or replace the unexpected character with valid DSL syntax. Only use alphanumeric characters, underscores, and recognized operators.

---

### E1002: UNTERMINATED_STRING

**Description**: A string literal was opened with a quote but never closed.

**Causes**:
- Missing closing quote
- Newline inside string literal
- Escape sequence errors

**Example**:
```dsl
kernel "Unterminated {
    config(0xF, 0);

    cycle {
        @0,0: EXIT;
    }
}
```

**How to Fix**: Ensure all string literals have matching opening and closing quotes. If you need multi-line strings, close and concatenate them, or use proper escaping.

**Corrected**:
```dsl
kernel "Unterminated" {
    config(0xF, 0);

    cycle {
        @0,0: EXIT;
    }
}
```

---

### E1003: INVALID_NUMBER

**Description**: A numeric literal has an invalid format.

**Causes**:
- Malformed hexadecimal numbers
- Multiple decimal points
- Invalid digit for number base
- Out-of-range values

**Example**:
```dsl
.const INVALID 0x12G5  // G is not a valid hex digit
.const BAD_DEC 12.34.56  // Multiple decimal points

kernel "Test" {
    config(0xF, 0);

    cycle {
        @0,0: SADD R0, ZERO, IMM(12.34);  // Decimals not allowed in IMM
    }
}
```

**How to Fix**:
- For hexadecimal: use only 0-9, A-F (e.g., `0x12F5`)
- For decimal: use only one decimal point
- For immediate values: use integers only

---

### E1004: UNKNOWN_DIRECTIVE

**Description**: A directive starting with `.` is not recognized.

**Causes**:
- Typo in directive name
- Using an unsupported directive
- Missing space after directive

**Example**:
```dsl
.konstant THRESHOLD 100  // Should be .const
.datta input { 1, 2, 3 }  // Should be .data
.alias counter R0  // This is correct

kernel "Test" {
    config(0xF, 0);

    cycle {
        @0,0: EXIT;
    }
}
```

**How to Fix**: Use only supported directives: `.const`, `.data`, `.alias`. Check spelling carefully.

**Corrected**:
```dsl
.const THRESHOLD 100
.data input { 1, 2, 3 }
.alias counter R0
```

---

## Parser Errors (E2xxx)

Parser errors occur when the token sequence doesn't match the expected DSL grammar.

### E2001: UNEXPECTED_TOKEN

**Description**: The parser encountered a token that doesn't fit the current syntax context.

**Causes**:
- Wrong keyword in wrong place
- Missing or extra tokens
- Incorrect syntax structure

**Example**:
```dsl
kernel "Test" {
    config(0xF, 0);

    cycle {
        @0,0 SADD R0, ZERO, ZERO;  // Missing colon after @0,0
    }

    cycle {
        @0,0: EXIT;
    }
}
```

**How to Fix**: Review the syntax for the current construct. Ensure proper punctuation (colons, semicolons, commas, braces).

**Corrected**:
```dsl
@0,0: SADD R0, ZERO, ZERO;  // Colon added
```

---

### E2002: EXPECTED_TOKEN

**Description**: The parser expected a specific token but found something else.

**Causes**:
- Missing semicolons
- Missing braces
- Missing commas in parameter lists
- Incomplete expressions

**Example**:
```dsl
kernel "Test" {
    config(0xF, 0)  // Missing semicolon

    cycle {
        @0,0: SADD R0, ZERO, IMM(42)  // Missing semicolon
    }

    cycle {
        @0,0: EXIT;
    }
// Missing closing brace
```

**How to Fix**: Add the expected token. Common fixes:
- Add `;` after statements
- Add `}` to close blocks
- Add `,` between list items

**Corrected**:
```dsl
kernel "Test" {
    config(0xF, 0);  // Semicolon added

    cycle {
        @0,0: SADD R0, ZERO, IMM(42);  // Semicolon added
    }

    cycle {
        @0,0: EXIT;
    }
}  // Closing brace added
```

---

### E2003: MISSING_KERNEL

**Description**: The source file doesn't contain a required `kernel` declaration.

**Causes**:
- Empty or incomplete file
- Kernel keyword misspelled
- Kernel declaration commented out

**Example**:
```dsl
.const VALUE 100

config(0xF, 0);  // Config without kernel

cycle {
    @0,0: EXIT;
}
```

**How to Fix**: Every DSL file must contain at least one kernel declaration. Wrap your configuration and cycles inside a kernel block.

**Corrected**:
```dsl
.const VALUE 100

kernel "Main" {
    config(0xF, 0);

    cycle {
        @0,0: EXIT;
    }
}
```

---

### E2004: MISSING_CONFIG

**Description**: A kernel declaration is missing the required `config()` statement.

**Causes**:
- Forgot to add config
- Config placed outside kernel
- Config keyword misspelled

**Example**:
```dsl
kernel "Test" {
    cycle {
        @0,0: EXIT;
    }
}
```

**How to Fix**: Add a `config(active_mask, entry_point)` statement at the beginning of the kernel block.

**Corrected**:
```dsl
kernel "Test" {
    config(0xF, 0);

    cycle {
        @0,0: EXIT;
    }
}
```

---

### E2005: INVALID_SYNTAX

**Description**: The parser encountered a syntax structure that doesn't conform to the DSL grammar.

**Causes**:
- Incorrect nesting of constructs
- Malformed expressions
- Invalid statement combinations

**Example**:
```dsl
kernel "Test" {
    config(0xF, 0);

    cycle {
        @0,0: SADD R0, ZERO, , IMM(42);  // Extra comma
        @0,1: LWI R0 input[0];  // Missing comma
    }

    cycle {
        @0,0: EXIT;
    }
}
```

**How to Fix**: Review the syntax rules for the specific construct. Ensure proper operator placement and argument lists.

**Corrected**:
```dsl
@0,0: SADD R0, ZERO, IMM(42);  // Extra comma removed
@0,1: LWI R0, input[0];  // Comma added
```

---

## Semantic Errors (E3xxx)

Semantic errors occur when the syntax is correct but the meaning is invalid.

### E3001: UNDEFINED_IDENTIFIER

**Description**: Reference to an identifier that hasn't been defined.

**Causes**:
- Typo in variable name
- Using identifier before declaration
- Forgot to declare constant or alias

**Example**:
```dsl
.const THRESHOLD 100

kernel "Test" {
    config(0xF, 0);

    cycle {
        @0,0: SADD R0, ZERO, LIMIT;  // LIMIT not defined
        @0,1: SADD R1, ZERO, .TRESHOLD;  // Typo: TRESHOLD vs THRESHOLD
    }

    cycle {
        @0,0: EXIT;
    }
}
```

**How to Fix**:
- Check spelling of identifiers
- Ensure constants are declared with `.const`
- Ensure aliases are declared with `.alias`
- Use `.` prefix when referencing constants in some contexts

**Corrected**:
```dsl
.const THRESHOLD 100
.const LIMIT 200  // Added missing constant

kernel "Test" {
    config(0xF, 0);

    cycle {
        @0,0: SADD R0, ZERO, LIMIT;
        @0,1: SADD R1, ZERO, .THRESHOLD;  // Fixed spelling
    }

    cycle {
        @0,0: EXIT;
    }
}
```

---

### E3002: UNDEFINED_ARRAY

**Description**: Reference to an array that hasn't been declared.

**Causes**:
- Array name typo
- Forgot to declare array with `.data`
- Using array before declaration

**Example**:
```dsl
.data input { 10, 20, 30 }

kernel "Test" {
    config(0xF, 0);

    cycle {
        @0,0: LWI R0, input[0];    // OK
        @0,1: LWI R1, output[0];   // output not declared
    }

    cycle {
        @0,0: EXIT;
    }
}
```

**How to Fix**: Declare all arrays using `.data` directive before referencing them.

**Corrected**:
```dsl
.data input { 10, 20, 30 }
.data output { 0, 0, 0 }  // Added missing array

kernel "Test" {
    config(0xF, 0);

    cycle {
        @0,0: LWI R0, input[0];
        @0,1: LWI R1, output[0];
    }

    cycle {
        @0,0: EXIT;
    }
}
```

---

### E3003: ARRAY_OUT_OF_BOUNDS

**Description**: Array index exceeds the declared array bounds.

**Causes**:
- Index larger than array size
- Negative index
- Off-by-one error (forgetting zero-based indexing)

**Example**:
```dsl
.data values { 10, 20, 30 }  // Array size: 3 (indices 0-2)

kernel "Test" {
    config(0xF, 0);

    cycle {
        @0,0: LWI R0, values[3];  // Out of bounds! Max index is 2
        @0,1: LWI R1, values[-1]; // Negative index invalid
    }

    cycle {
        @0,0: EXIT;
    }
}
```

**How to Fix**:
- Arrays are zero-indexed: for size N, valid indices are 0 to N-1
- Check your array declarations
- Use `.len()` property if you need dynamic bounds checking

**Corrected**:
```dsl
.data values { 10, 20, 30 }

kernel "Test" {
    config(0xF, 0);

    cycle {
        @0,0: LWI R0, values[2];  // Valid: last element
        @0,1: LWI R1, values[0];  // Valid: first element
    }

    cycle {
        @0,0: EXIT;
    }
}
```

---

### E3004: INVALID_REGISTER

**Description**: Reference to a register that doesn't exist or is invalid.

**Causes**:
- Register number out of range
- Typo in register name
- Using architectural register incorrectly

**Example**:
```dsl
kernel "Test" {
    config(0xF, 0);

    cycle {
        @0,0: SADD R32, ZERO, IMM(42);  // R32 may be out of range
        @0,1: SADD r0, ZERO, IMM(1);    // Lowercase r0 invalid
        @0,2: SADD ZER0, ZERO, IMM(2);  // ZERO (ZER0) cannot be destination
    }

    cycle {
        @0,0: EXIT;
    }
}
```

**How to Fix**:
- Use valid register names: R0-R31, ZERO (read-only)
- Use uppercase for register names
- Don't write to ZERO register

**Corrected**:
```dsl
kernel "Test" {
    config(0xF, 0);

    cycle {
        @0,0: SADD R0, ZERO, IMM(42);   // Valid register
        @0,1: SADD R1, ZERO, IMM(1);    // Uppercase
        @0,2: SADD R2, ZERO, IMM(2);    // Different destination
    }

    cycle {
        @0,0: EXIT;
    }
}
```

---

### E3005: INVALID_OPERAND

**Description**: An instruction operand has an invalid type or value.

**Causes**:
- Wrong operand type for instruction
- Invalid immediate value range
- Using memory operand where register expected

**Example**:
```dsl
kernel "Test" {
    config(0xF, 0);

    cycle {
        @0,0: SADD R0, IMM(10), IMM(20);  // Both sources can't be immediate
        @0,1: LWI R1, R2;  // LWI expects memory address, not register
    }

    cycle {
        @0,0: EXIT;
    }
}
```

**How to Fix**:
- Check instruction operand requirements in ISA documentation
- At most one operand can be an immediate value
- Use correct addressing modes

**Corrected**:
```dsl
.data memory { 0 }

kernel "Test" {
    config(0xF, 0);

    cycle {
        @0,0: SADD R0, R1, IMM(20);     // One register, one immediate
        @0,1: LWI R1, memory[0];        // Memory address
    }

    cycle {
        @0,0: EXIT;
    }
}
```

---

### E3006: DUPLICATE_DEFINITION

**Description**: An identifier is defined more than once.

**Causes**:
- Defining same constant twice
- Declaring same array multiple times
- Reusing alias names

**Example**:
```dsl
.const VALUE 100
.const VALUE 200  // Duplicate!

.data input { 1, 2, 3 }
.data input { 4, 5, 6 }  // Duplicate!

.alias counter R0
.alias counter R1  // Duplicate!

kernel "Test" {
    config(0xF, 0);

    cycle {
        @0,0: EXIT;
    }
}
```

**How to Fix**: Use unique names for all constants, arrays, and aliases. If you need to change a value, use a different name or remove the previous definition.

**Corrected**:
```dsl
.const VALUE 100
.const OTHER_VALUE 200  // Different name

.data input { 1, 2, 3 }
.data output { 4, 5, 6 }  // Different name

.alias counter R0
.alias index R1  // Different name

kernel "Test" {
    config(0xF, 0);

    cycle {
        @0,0: EXIT;
    }
}
```

---

### E3007: UNDEFINED_LABEL

**Description**: A branch instruction references a label that doesn't exist.

**Causes**:
- Typo in label name
- Label not declared
- Label declared in wrong scope

**Example**:
```dsl
kernel "Test" {
    config(0xF, 0);

    cycle {
        @0,0: BEQ R0, R1, loop_start;  // Label doesn't exist
    }

    cycle {
    loop_end:  // Wrong label
        @0,0: EXIT;
    }
}
```

**How to Fix**: Ensure the label is declared before it's used, and the name matches exactly.

**Corrected**:
```dsl
kernel "Test" {
    config(0xF, 0);

loop_start:
    cycle {
        @0,0: BEQ R0, R1, loop_start;  // Label now exists
    }

    cycle {
        @0,0: EXIT;
    }
}
```

---

### E3008: UNDEFINED_FUNCTION

**Description**: A function call references a function that hasn't been defined.

**Causes**:
- Function name typo
- Function not declared before use
- Wrong function name

**Example**:
```dsl
kernel "Test" {
    config(0xF, 0);

    cycle {
        @0,0: SADD R0, ZERO, calculate_value();  // Function not defined
    }

    cycle {
        @0,0: EXIT;
    }
}
```

**How to Fix**: Define the function before calling it, or check that the function name is spelled correctly.

**Corrected**:
```dsl
fn calculate_value() {
    // Function implementation
    return 42;
}

kernel "Test" {
    config(0xF, 0);

    cycle {
        @0,0: SADD R0, ZERO, calculate_value();
    }

    cycle {
        @0,0: EXIT;
    }
}
```

---

## Code Generation Errors (E4xxx)

Code generation errors occur when translating valid DSL to target architecture code.

### E4001: INVALID_INSTRUCTION

**Description**: An instruction cannot be encoded for the target architecture.

**Causes**:
- Instruction not supported by target ISA
- Instruction variant doesn't exist
- Encoding constraints violated

**Example**:
```dsl
kernel "Test" {
    config(0xF, 0);

    cycle {
        @0,0: UNKNOWN_OP R0, R1, R2;  // Not a valid instruction
        @0,1: SADD R0, R1, R2, R3;    // Too many operands
    }

    cycle {
        @0,0: EXIT;
    }
}
```

**How to Fix**: Use only supported instructions from the OpenEdgeCGRA ISA. Check operand counts and types.

**Corrected**:
```dsl
kernel "Test" {
    config(0xF, 0);

    cycle {
        @0,0: SADD R0, R1, R2;  // Valid 3-operand ADD
        @0,1: SMUL R1, R2, R3;  // Valid multiply
    }

    cycle {
        @0,0: EXIT;
    }
}
```

---

### E4002: INVALID_BRANCH_TARGET

**Description**: A branch instruction targets an invalid or unreachable location.

**Causes**:
- Branch offset too large
- Target outside kernel bounds
- Invalid cycle as branch target

**Example**:
```dsl
kernel "Test" {
    config(0xF, 0);

    cycle {
        @0,0: BEQ R0, R1, external_label;  // Target not in kernel
    }

    cycle {
        @0,0: EXIT;
    }
}

external_label:
    // This is outside the kernel
```

**How to Fix**: Ensure branch targets are within the same kernel and properly labeled.

**Corrected**:
```dsl
kernel "Test" {
    config(0xF, 0);

    cycle {
        @0,0: BEQ R0, R1, internal_label;
    }

internal_label:
    cycle {
        @0,0: EXIT;
    }
}
```

---

### E4003: MEMORY_OVERLAP

**Description**: Memory regions for different arrays overlap.

**Causes**:
- Explicit address assignment conflicts
- Automatic allocation overlap
- Insufficient memory space

**Example**:
```dsl
.data array1 @ 0x1000 { 1, 2, 3, 4, 5, 6, 7, 8 }
.data array2 @ 0x1004 { 10, 20, 30, 40 }  // Overlaps with array1!

kernel "Test" {
    config(0xF, 0);

    cycle {
        @0,0: EXIT;
    }
}
```

**How to Fix**:
- Adjust explicit addresses to avoid overlap
- Let the compiler auto-allocate addresses
- Ensure sufficient spacing between arrays

**Corrected**:
```dsl
.data array1 @ 0x1000 { 1, 2, 3, 4, 5, 6, 7, 8 }  // 8 words = 32 bytes
.data array2 @ 0x1020 { 10, 20, 30, 40 }          // Start after array1

kernel "Test" {
    config(0xF, 0);

    cycle {
        @0,0: EXIT;
    }
}
```

---

### E4004: INVALID_OPERAND_COUNT

**Description**: Instruction has wrong number of operands for code generation.

**Causes**:
- Missing operands
- Extra operands
- Incorrect instruction form

**Example**:
```dsl
kernel "Test" {
    config(0xF, 0);

    cycle {
        @0,0: SADD R0, R1;        // Missing third operand
        @0,1: SMUL R0;            // Missing both source operands
        @0,2: LWI R0, R1, R2;     // Too many operands
    }

    cycle {
        @0,0: EXIT;
    }
}
```

**How to Fix**: Provide the correct number of operands for each instruction according to the ISA specification.

**Corrected**:
```dsl
.data memory { 0 }

kernel "Test" {
    config(0xF, 0);

    cycle {
        @0,0: SADD R0, R1, R2;     // Three operands for ADD
        @0,1: SMUL R0, R1, R2;     // Three operands for MUL
        @0,2: LWI R0, memory[0];   // Two operands for load
    }

    cycle {
        @0,0: EXIT;
    }
}
```

---

## Warnings (W5xxx)

Warnings indicate potential issues that don't prevent compilation but may cause unexpected behavior.

### W5001: DUPLICATE_PE_INSTRUCTION

**Description**: Multiple instructions assigned to the same PE in a single cycle.

**Causes**:
- Accidentally assigning two operations to same coordinates
- Copy-paste errors
- Logic errors in parallel code

**Example**:
```dsl
kernel "Test" {
    config(0xF, 0);

    cycle {
        @0,0: SADD R0, ZERO, IMM(10);
        @0,0: SMUL R1, R2, R3;      // WARNING: Same PE (0,0) used twice!
        @0,1: SADD R2, ZERO, IMM(20);
    }

    cycle {
        @0,0: EXIT;
    }
}
```

**Impact**: Only the last instruction will execute. The first instruction is overwritten and lost.

**How to Fix**:
- Use different PE coordinates for parallel operations
- If sequential execution is intended, use separate cycles
- Review your parallelization strategy

**Corrected - Parallel**:
```dsl
kernel "Test" {
    config(0xF, 0);

    cycle {
        @0,0: SADD R0, ZERO, IMM(10);  // PE (0,0)
        @0,1: SMUL R1, R2, R3;         // PE (0,1) - different PE!
        @1,0: SADD R2, ZERO, IMM(20);  // PE (1,0)
    }

    cycle {
        @0,0: EXIT;
    }
}
```

**Corrected - Sequential**:
```dsl
kernel "Test" {
    config(0xF, 0);

    cycle {
        @0,0: SADD R0, ZERO, IMM(10);  // First operation
    }

    cycle {
        @0,0: SMUL R1, R2, R3;         // Second operation, next cycle
    }

    cycle {
        @0,0: SADD R2, ZERO, IMM(20);  // Third operation
    }

    cycle {
        @0,0: EXIT;
    }
}
```

---

## Additional Resources

- [Language Specification](../spec/01-overview.md) - Complete DSL syntax reference
- [Compilation Process](../spec/05-compilation.md) - Understanding the compilation phases
- [ISA Reference](https://github.com/cgra-research/OpenEdgeCGRA-ISA) - Instruction set details
- [Examples](../examples/) - Working code samples

## Quick Troubleshooting

1. **Syntax errors (E1xxx, E2xxx)**: Check for typos, missing punctuation, and proper structure
2. **Undefined references (E3001, E3002)**: Verify all identifiers are declared before use
3. **Array issues (E3003)**: Remember arrays are zero-indexed
4. **Register problems (E3004)**: Use R0-R31, avoid writing to ZERO
5. **Duplicate PEs (W5001)**: Ensure each PE has at most one instruction per cycle

When encountering an error, check the error code against this reference for specific guidance on the cause and solution.
