# Functions

[← Features Index](README.md) | [Main Index](../README.md) | [Next: For Loops →](loops/for-loops.md)

---

Functions allow defining reusable blocks of code with parameters. They must be defined before the `kernel` block.

## Syntax

**Definition (basic):**
```c
function NAME(param1, param2) {
    // body
}
```

**Definition (with typed parameters):**
```c
function NAME(param1: TYPE1, param2: TYPE2) {
    // body - types are for documentation only
}
```

**Usage:**
```c
NAME(arg1, arg2);
```

> [!NOTE]
> Parameter types are optional and used for documentation/tooling. They don't affect runtime behavior - all parameters are substituted textually.

---

## Basic Example

```c
// Define a function to configure a PE
function CONFIG_PE(r, c, op) {
    row r { col c: op; }
}

kernel "FunctionTest" {
    config(0xF, 0);
    cycle {
        // Expands to: row 0 { col 0: SADD R1, R1, IMM(1); }
        CONFIG_PE(0, 0, SADD R1, R1, IMM(1));

        // Expands to: row 0 { col 1: SMUL R2, R2, R2; }
        CONFIG_PE(0, 1, SMUL R2, R2, R2);
    }
}
```

**Compiled Result:**
```text
Cycle 0:
Row 0: SADD R1, R1, IMM(1) | SMUL R2, R2, R2 | NOP | NOP
...
Cycle 1 (Implicit Exit):
Row 0: EXIT | NOP | NOP | NOP
...
```

---

## Typed Parameters Example

Use typed parameters to document expected argument types:

```c
// Types are for documentation - they describe what should be passed
function MAC(a: register, b: register, acc: register) {
    cycle { @0,0: SMUL R3, a, b; }     // R3 = a * b
    cycle { @0,0: SADD acc, acc, R3; } // acc += R3
}

kernel "TypedParamsDemo" {
    config(0xF, 0);
    
    // Initialize accumulator
    cycle { @0,0: SADD R2, ZERO, ZERO; }
    
    // Load values
    cycle { @0,0: SADD R0, ZERO, IMM(5); }
    cycle { @0,0: SADD R1, ZERO, IMM(3); }
    
    // Call with typed params: MAC(R0, R1, R2) -> R2 += R0 * R1
    MAC(R0, R1, R2);
    
    cycle { @0,0: EXIT; }
}
```

**Result:** R2 = 0 + (5 * 3) = 15

---

## Parameter Substitution

Parameters are substituted textually before expansion. This means:

- Parameters can be used as row/column indices
- Parameters can be part of instruction operands
- Parameters can be entire instructions

```c
function INIT_REG(idx) {
    row 0: LWI R0, idx | _ | _ | _;
}

kernel "ParamExample" {
    config(0xF, 0);

    cycle { INIT_REG(0); }   // LWI R0, 0
    cycle { INIT_REG(4); }   // LWI R0, 4
    cycle { INIT_REG(8); }   // LWI R0, 8
}
```

---

## Functions with For Loops

The iteration variable is substituted before function expansion:

```c
function INIT_REG(idx) {
    row 0: LWI R0, idx | _ | _ | _;
}

kernel "ForWithFunction" {
    config(0xF, 0);

    for i in range(4) {
        cycle {
            INIT_REG(i);  // i is substituted before INIT_REG expands
        }
    }
}
```

**Expected Output:**
```text
Cycle 0: LWI R0, 0 | NOP | NOP | NOP
Cycle 1: LWI R0, 1 | NOP | NOP | NOP
Cycle 2: LWI R0, 2 | NOP | NOP | NOP
Cycle 3: LWI R0, 3 | NOP | NOP | NOP
Cycle 4: EXIT | NOP | NOP | NOP
```

---

## Multi-Parameter Functions with Loops

Functions can have multiple parameters including computed expressions from loop variables:

```c
function FILL_PE(row_idx, col_idx, value) {
    @row_idx, col_idx: SADD R0, IMM(value), IMM(0);
}

kernel "FillGrid" {
    config(0xF, 0);

    // Fill a 2x2 grid with computed values
    for i in range(2) {
        for j in range(2) {
            cycle {
                FILL_PE(i, j, i*2+j);  // Expression evaluated before substitution
            }
        }
    }
}
```

**Expected Output:**
```text
Cycle 0: PE[0,0] = SADD R0, IMM(0), IMM(0)  // i=0, j=0 → 0*2+0 = 0
Cycle 1: PE[0,1] = SADD R0, IMM(1), IMM(0)  // i=0, j=1 → 0*2+1 = 1
Cycle 2: PE[1,0] = SADD R0, IMM(2), IMM(0)  // i=1, j=0 → 1*2+0 = 2
Cycle 3: PE[1,1] = SADD R0, IMM(3), IMM(0)  // i=1, j=1 → 1*2+1 = 3
Cycle 4: EXIT
```

---

## Function with Expression Arguments

Loop expressions are evaluated before being passed to functions:

```c
function STORE_AT(addr) {
    row 0: SWI R0, addr | _ | _ | _;
}

kernel "ExpressionArgs" {
    config(0xF, 0);

    for i in range(4) {
        cycle {
            STORE_AT(i*8);  // Evaluates to 0, 8, 16, 24
        }
    }
}
```

**Expected Output:**
```text
Cycle 0: SWI R0, 0 | NOP | NOP | NOP
Cycle 1: SWI R0, 8 | NOP | NOP | NOP
Cycle 2: SWI R0, 16 | NOP | NOP | NOP
Cycle 3: SWI R0, 24 | NOP | NOP | NOP
Cycle 4: EXIT | NOP | NOP | NOP
```

---

## Inlining

All functions are inlined at compile time. The `#pragma inline` directive is available for explicit annotation but is the default behavior:

```c
#pragma inline
function DOUBLE(reg) {
    row 0: SADD reg, reg, reg | _ | _ | _;
}
```

---

## Automatic Label Prefixing

When a function contains internal labels (e.g., for loops or branches), the compiler automatically prefixes them with a unique identifier to avoid collisions when the same function is called multiple times.

### The Problem

Without prefixing, calling the same function twice would create duplicate labels:

```c
function LOOP_FUNC(count) {
    start_loop:                          // Label defined
    cycle { @0,0: SSUB R0, R0, IMM(1); }
    cycle { @0,0: BGE R0, IMM(0), start_loop; }  // Jump to label
}

kernel "Test" {
    config(0xF, 0);
    LOOP_FUNC(5);  // Creates start_loop
    LOOP_FUNC(3);  // ERROR: start_loop already exists!
}
```

### The Solution

The compiler automatically prefixes labels with the function name and a unique expansion ID:

```c
// First call: LOOP_FUNC(5)
_LOOP_FUNC_0_start_loop:
cycle { @0,0: SSUB R0, R0, IMM(1); }
cycle { @0,0: BGE R0, IMM(0), _LOOP_FUNC_0_start_loop; }

// Second call: LOOP_FUNC(3)
_LOOP_FUNC_1_start_loop:
cycle { @0,0: SSUB R0, R0, IMM(1); }
cycle { @0,0: BGE R0, IMM(0), _LOOP_FUNC_1_start_loop; }
```

### How It Works

1. **Detection**: The parser scans function tokens for label definitions (identifier followed by `:`)
2. **Prefixing**: All labels and their references are prefixed with `_<funcname>_<id>_`
3. **Uniqueness**: The expansion ID increments for each function call

### When Prefixing Applies

| Token Pattern | Prefixed? | Notes |
|---------------|-----------|-------|
| `start_loop:` | ✅ Yes | Label definition |
| `JUMP start_loop` | ✅ Yes | Label reference |
| `@0,0:` | ❌ No | Coordinate syntax, not a label |
| `param:` inside `row 0:` | ❌ No | Row syntax, not a label |

> [!NOTE]
> Label prefixing is automatic and transparent. You don't need to change your code - just define labels naturally and reuse functions freely.

---

## Functions with Internal Loops

Functions can contain loops that get expanded when the function is called:

### Basic Loop in Function

```c
function LOAD_VECTOR(count) {
    for i in range(count) {
        cycle {
            row 0: LWI R0, i | _ | _ | _;
        }
    }
}

kernel "TestInternalLoop" {
    config(0xF, 0);
    
    LOAD_VECTOR(4);
}
```

**Expected Output:**
```text
Cycle 0: LWI R0, 0 | NOP | NOP | NOP
Cycle 1: LWI R0, 1 | NOP | NOP | NOP
Cycle 2: LWI R0, 2 | NOP | NOP | NOP
Cycle 3: LWI R0, 3 | NOP | NOP | NOP
Cycle 4: EXIT | NOP | NOP | NOP
```

---

### Function with Multiple Cycle Pattern

```c
function LOAD_STORE_PAIR(addr) {
    cycle {
        row 0: LWI R0, addr | _ | _ | _;
    }
    cycle {
        row 0: SWI R0, addr | _ | _ | _;
    }
}

kernel "LoadStorePairs" {
    config(0xF, 0);
    
    for i in range(2) {
        LOAD_STORE_PAIR(i*4);
    }
}
```

**Expected Output:**
```text
Cycle 0: LWI R0, 0 | NOP | NOP | NOP
Cycle 1: SWI R0, 0 | NOP | NOP | NOP
Cycle 2: LWI R0, 4 | NOP | NOP | NOP
Cycle 3: SWI R0, 4 | NOP | NOP | NOP
Cycle 4: EXIT | NOP | NOP | NOP
```

---

### Combining Loops Inside and Outside Functions

```c
function INIT_ROW(row_idx, value) {
    @row_idx, 0: SADD R0, IMM(value), IMM(0);
}

kernel "CombinedLoops" {
    config(0xF, 0);
    
    for i in range(4) {
        cycle {
            INIT_ROW(i, i*10);
        }
    }
}
```

**Expected Output:**
```text
Cycle 0: PE[0,0] = SADD R0, IMM(0), IMM(0)
Cycle 1: PE[1,0] = SADD R0, IMM(10), IMM(0)
Cycle 2: PE[2,0] = SADD R0, IMM(20), IMM(0)
Cycle 3: PE[3,0] = SADD R0, IMM(30), IMM(0)
Cycle 4: EXIT
```

---

### Function with For Loop and If-Else

Functions can contain loops with conditional branches:

```c
function PROCESS_VALUES(count) {
    for i in range(count) {
        // Set R0 = i (the loop index)
        cycle { @0,0: SADD R0, ZERO, IMM(i); }
        
        // Branch based on R0 value at runtime
        if (R0 < IMM(2)) @0,0 {
            cycle { @0,0: SADD R1, R1, IMM(10); }
        } else {
            cycle { @0,0: SADD R1, R1, IMM(20); }
        }
    }
}

kernel "IfElseInFunction" {
    config(0xF, 0);
    
    // Initialize R1 = 0
    cycle { @0,0: SADD R1, ZERO, ZERO; }
    
    PROCESS_VALUES(4);
    
    // Verify: R1 should be 10+10+20+20 = 60
    .assert { cycle: 21, location: 0,0, register: R1, value: 60 }
}
```

**How it works:**
- R1 is initialized to 0
- For each iteration (i=0,1,2,3), the loop body is expanded at compile time
- Each iteration generates 5 cycles: set R0, branch, then-block, jump, else-block
- At runtime, the branch decides which path to take based on R0's value

**Expected Output (22 cycles total):**
```text
Cycle  0: SADD R1, ZERO, ZERO  // R1 = 0 (initialization)

// Iteration i=0: R0 = 0, 0 < 2 → takes THEN branch (+10)
Cycle  1: SADD R0, ZERO, 0
Cycle  2: BGE R0, 2, 5        // Skip to else if R0 >= 2
Cycle  3: SADD R1, R1, 10     // THEN: R1 = 0 + 10 = 10
Cycle  4: JUMP 6, ZERO        // Skip else
Cycle  5: SADD R1, R1, 20     // ELSE (skipped at runtime)

// Iteration i=1: R0 = 1, 1 < 2 → takes THEN branch (+10)
Cycle  6: SADD R0, ZERO, 1
Cycle  7: BGE R0, 2, 10
Cycle  8: SADD R1, R1, 10     // THEN: R1 = 10 + 10 = 20
Cycle  9: JUMP 11, ZERO
Cycle 10: SADD R1, R1, 20     // ELSE (skipped)

// Iteration i=2: R0 = 2, 2 >= 2 → takes ELSE branch (+20)
Cycle 11: SADD R0, ZERO, 2
Cycle 12: BGE R0, 2, 15       // Jumps to else!
Cycle 13: SADD R1, R1, 10     // THEN (skipped at runtime)
Cycle 14: JUMP 16, ZERO
Cycle 15: SADD R1, R1, 20     // ELSE: R1 = 20 + 20 = 40

// Iteration i=3: R0 = 3, 3 >= 2 → takes ELSE branch (+20)
Cycle 16: SADD R0, ZERO, 3
Cycle 17: BGE R0, 2, 20       // Jumps to else!
Cycle 18: SADD R1, R1, 10     // THEN (skipped)
Cycle 19: JUMP 21, ZERO
Cycle 20: SADD R1, R1, 20     // ELSE: R1 = 40 + 20 = 60

Cycle 21: EXIT
```

**Verified:** `R1 = 0 + 10 + 10 + 20 + 20 = 60` ✓

---

## Best Practices

1. **Name functions clearly** - Use descriptive names like `INIT_REG`, `CONFIG_PE`
2. **Keep functions simple** - Single responsibility
3. **Document parameters** - Comment what each parameter does
4. **Use for repetitive patterns** - Avoid code duplication
5. **Consider loop placement** - Loops inside functions expand at call site

---

## Navigation

- [← Features Index](README.md)
- [Main Index](../README.md)
- [Next: For Loops →](loops/for-loops.md)

