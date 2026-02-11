# Example: Factorial

[← Examples Index](../README.md) | [Main Index](../../README.md)

---

Computing factorial with multi-cycle while body.

## Factorial (5! = 120)

Since we need two operations per iteration (multiply + decrement), the body has 2 cycles:

<!-- expect: R0@0,0=120, R1@0,0=1 -->
```c
kernel "Factorial_Correct" {
    config(0xF, 0);

    // Initialize: result=1, counter=5
    // Note: One instruction per PE per cycle
    cycle {
        @0,0: SADD R0, ZERO, IMM(1);   // result = 1
    }
    cycle {
        @0,0: SADD R1, ZERO, IMM(5);   // counter = 5
    }

    // while (counter > 1): result *= counter; counter--
    while (R1 > IMM(1)) @0,0 {
        cycle {
            @0,0: SMUL R0, R0, R1;     // result *= counter
        }
        cycle {
            @0,0: SSUB R1, R1, IMM(1); // counter--
        }
    }

    // Verify (using multi-value ASSERT format)
    cycle {
        @0,0: ASSERT R0: 120, R1: 1;   // 5! = 120, counter ended at 1
    }
    cycle {
        @0,0: EXIT;
    }
}
```

**Cycles:** ~21 (2 init + 4×4 iterations + 1 final check + 1 assert + 1 exit)

## Execution Trace

| Iteration | counter (R1) | result (R0) | Operation |
|-----------|--------------|-------------|-----------|
| Init | 5 | 1 | - |
| 1 | 5→4 | 1×5=5 | 5>1 ✓ |
| 2 | 4→3 | 5×4=20 | 4>1 ✓ |
| 3 | 3→2 | 20×3=60 | 3>1 ✓ |
| 4 | 2→1 | 60×2=120 | 2>1 ✓ |
| Exit | 1 | 120 | 1>1 ✗ |

## Generated Code

```
Cycle 0:  SADD R0,ZERO,1                     ← Init result = 1
Cycle 1:  SADD R1,ZERO,5                     ← Init counter = 5
Cycle 2:  BGE 1,R1,exit                      ← 1>=5? no, continue
Cycle 3:  SMUL R0,R0,R1                      ← result = 1×5 = 5
Cycle 4:  SSUB R1,R1,1                       ← counter = 5-1 = 4
Cycle 5:  JUMP 0,0,2                         ← Back to condition
Cycle 6:  BGE 1,R1,exit                      ← 1>=4? no
Cycle 7:  SMUL R0,R0,R1                      ← result = 5×4 = 20
Cycle 8:  SSUB R1,R1,1                       ← counter = 3
...
Cycle 18: BGE 1,R1,exit                      ← 1>=1? yes! exit
Cycle 19: ASSERT R0:120,R1:1
Cycle 20: EXIT
```

**Note:** `R1 > 1` compiles to `BGE 1, R1, exit` (operands swapped).

## Structure

For multi-cycle body:
- Condition: 1 cycle
- Body: N cycles (here N=2)
- Jump: 1 cycle
- **Total per iteration:** N + 2 cycles

## Alternative: Single PE

Since we need both multiply and decrement, optimization is disabled. This is the expected behavior for complex operations.

## Alternative: Parallel Factorial

For computing multiple factorials in parallel, use `#pragma parallel`:

```c
.data 0 { 1, 2, 3, 4 }  // Compute 1!, 2!, 3!, 4!

#pragma parallel
for i in range(4) {
    cycle { @0,0: LWI R1, data[i]; }  // Load n
    cycle { @0,0: SADD R0, ZERO, IMM(1); }  // result = 1

    // Note: while inside parallel is not supported
    // Would need unrolled approach
}
```

---

## Navigation

- [← Examples Index](../README.md)
- [Main Index](../../README.md)
