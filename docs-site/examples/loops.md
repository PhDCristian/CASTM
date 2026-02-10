---
title: Loop Patterns
outline: deep
---

# Loop Patterns

Complete examples demonstrating for and while loops in OpenEdge DSL.

## For Range

Compile-time unrolled iteration with data references:

```c
.data 0 { 100, 200, 300, 400 }

kernel "ForRange" {
    config(0xF, 0);

    for i in range(4) {
        cycle {
            @0,0: LWI R0, data[i];
        }
        cycle {
            @0,0: SWD R0;
        }
    }

    cycle {
        @0,0: EXIT;
    }
}
```

---

## While Counter

Runtime loop with accumulation:

```c
kernel "SumRange_While" {
    config(0xF, 0);

    cycle { @0,0: SADD R0, ZERO, IMM(0); }
    cycle { @0,0: SADD R1, ZERO, IMM(0); }

    while (R0 < IMM(10)) @0,0 {
        cycle { @0,0: SADD R1, R1, R0; }
        cycle { @0,0: SADD R0, R0, IMM(1); }
    }

    cycle { @0,0: ASSERT R1, 45; }
    cycle { @0,0: EXIT; }
}
```

**Expected:** R1 = 0 + 1 + 2 + ... + 9 = 45

---

## Optimized While (Adjacent PE)

When the body PE is adjacent to the control PE, the compiler fuses body + jump (2 cycles/iter):

```c
kernel "WhileOptimized" {
    config(0xF, 0);

    cycle { @0,0: SADD R0, ZERO, IMM(0); }

    while (R0 < IMM(100)) @0,0 {
        cycle { @0,1: SADD R0, R0, IMM(1); }
    }

    cycle { @0,0: EXIT; }
}
```

---

## Factorial

Multi-cycle body with while loop:

```c
kernel "Factorial_5" {
    config(0xF, 0);

    cycle { @0,0: SADD R0, ZERO, IMM(1); }  // result = 1
    cycle { @0,0: SADD R1, ZERO, IMM(5); }  // n = 5

    while (R1 > IMM(1)) @0,0 {
        cycle { @0,0: SMUL R0, R0, R1; }
        cycle { @0,0: SSUB R1, R1, IMM(1); }
    }

    cycle { @0,0: ASSERT R0, 120; }
    cycle { @0,0: EXIT; }
}
```

**Expected:** 5! = 120
