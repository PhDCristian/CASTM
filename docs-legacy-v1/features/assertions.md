# Test Assertions

[← Control Flow](control-flow.md) | [Main Index](../README.md) | [Next: Pragmas →](pragmas/README.md)

---

Assertions allow defining unit tests directly within the DSL. If the condition is not met during simulation, an error is raised.

## Syntax

```c
.assert {
    cycle: <N>,
    location: <row>,<col>,
    register: <REG>,
    value: <VAL>
}
```

---

## Example

```c
kernel "AssertionTest" {
    config(0xF, 0);

    // Cycle 0: Initialize R1 with 42
    cycle {
        row 0: SADD R1, ZERO, IMM(42) | _ | _ | _;
    }

    // Verify that at cycle 0, PE(0,0) has 42 in R1
    // Note: Assertions are checked AFTER the cycle executes
    .assert {
        cycle: 0,
        location: 0,0,
        register: R1,
        value: 42
    }

    cycle {
        @0,0: EXIT;
    }
}
```

---

## Runtime Behavior

| Result | Behavior |
|--------|----------|
| **Success** | Simulation continues if `R1 == 42` at Cycle 0 |
| **Failure** | Simulation halts with error message |

**Error format:**
```
Assertion failed: Cycle 0, PE(0,0) R1 expected 42, got <actual>
```

---

## Multiple Assertions

You can have multiple assertions throughout the kernel:

```c
kernel "MultiAssert" {
    config(0xF, 0);

    cycle {
        @0,0: SADD R0, ZERO, IMM(10);
        @0,1: SADD R0, ZERO, IMM(20);
    }

    .assert { cycle: 0, location: 0,0, register: R0, value: 10 }
    .assert { cycle: 0, location: 0,1, register: R0, value: 20 }

    cycle {
        @0,0: SADD R0, R0, R0;  // R0 = 20 at PE(0,0)
    }

    .assert { cycle: 1, location: 0,0, register: R0, value: 20 }

    cycle { @0,0: EXIT; }
}
```

---

## Inline ASSERT Instruction

For simpler cases, you can use the `ASSERT` instruction directly in code:

```c
cycle {
    @0,0: ASSERT R0, 42;  // Halts if R0 != 42
}
```

This is more concise than the `.assert` directive and is useful for:
- Quick sanity checks
- Post-condition verification
- Debugging

> **See also:** [DEBUG Instructions](../../CLAUDE.md#debugio-instructions-simulator-only) for `PRINT`, `CHECK`, `ASSERT`, `CHECKPOINT`, and `OUTPUT` instructions.

---

## Use Cases

1. **Unit Testing:** Verify expected values after operations
2. **Regression Testing:** Ensure changes don't break existing functionality
3. **Debugging:** Validate intermediate results
4. **Documentation:** Document expected behavior

---

## Navigation

- [← Control Flow](control-flow.md)
- [Main Index](../README.md)
- [Next: Pragmas →](pragmas/README.md)
