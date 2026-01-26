# Example: While Counter

[← Examples Index](../README.md) | [Main Index](../../README.md)

---

Basic runtime loop with counter.

## Simple Counter

<!-- expect: R0@0,0=10 -->
```c
kernel "Counter_While" {
    config(0xF, 0);

    // Initialize counter
    cycle {
        @0,0: SADD R0, ZERO, IMM(0);
    }

    // Count to 10
    while (R0 < IMM(10)) @0,0 {
        cycle {
            @0,0: SADD R0, R0, IMM(1);
        }
    }

    // Verify and exit
    cycle {
        @0,0: ASSERT R0, 10;
    }
    cycle {
        @0,0: EXIT;
    }
}
```

**Cycles:** ~33 (1 init + 10×3 per iteration + 1 final check + 1 exit)

## Generated Code

```
Cycle 0:  SADD R0, ZERO, 0           ← Init
Cycle 1:  BGE R0, 10, exit           ← Condition (0 < 10? yes)
Cycle 2:  SADD R0, R0, 1             ← Body (R0 = 1)
Cycle 3:  JUMP ZERO, ZERO, 1         ← Back to condition
Cycle 4:  BGE R0, 10, exit           ← Condition (1 < 10? yes)
...
Cycle 31: BGE R0, 10, exit           ← Condition (10 < 10? no)
Cycle 32: ASSERT R0, 10              ← Verify
Cycle 33: EXIT
```

## Sum Accumulator

<!-- expect: R1@0,0=45 -->
```c
kernel "SumRange_While" {
    config(0xF, 0);

    // Initialize: counter=0, sum=0
    // Note: One instruction per PE per cycle
    cycle {
        @0,0: SADD R0, ZERO, IMM(0);
    }
    cycle {
        @0,0: SADD R1, ZERO, IMM(0);
    }

    // Sum: 0 + 1 + 2 + ... + 9 = 45
    while (R0 < IMM(10)) @0,0 {
        cycle {
            @0,0: SADD R1, R1, R0;      // sum += counter
        }
        cycle {
            @0,0: SADD R0, R0, IMM(1);  // counter++
        }
    }

    // Verify
    cycle {
        @0,0: ASSERT R1, 45;
    }
    cycle {
        @0,0: EXIT;
    }
}
```

**Expected:** R1 = 0+1+2+3+4+5+6+7+8+9 = 45

## Descending Counter

<!-- expect: R0@0,0=0 -->
```c
kernel "Countdown" {
    config(0xF, 0);

    cycle {
        @0,0: SADD R0, ZERO, IMM(10);
    }

    // Count down from 10 to 1
    while (R0 > IMM(0)) @0,0 {
        cycle {
            @0,0: SSUB R0, R0, IMM(1);
        }
    }

    cycle {
        @0,0: ASSERT R0, 0;
    }
    cycle {
        @0,0: EXIT;
    }
}
```

**Note:** `R0 > 0` compiles to `BGE 0, R0, exit` (operands swapped).

---

## Navigation

- [← Examples Index](../README.md)
- [Main Index](../../README.md)
