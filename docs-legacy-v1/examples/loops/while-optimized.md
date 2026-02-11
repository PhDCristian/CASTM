# Example: While Optimized

[← Examples Index](../README.md) | [Main Index](../../README.md)

---

Using adjacent PEs to achieve 2 cycles per iteration.

## Optimized Counter

When body PE is **adjacent** to control PE, the compiler optimizes to 2 cycles/iter:

<!-- expect: R0@1,0=10 -->
```c
kernel "Counter_While_Optimized" {
    config(0xF, 0);

    // Initialize counter at body PE
    cycle {
        @1,0: SADD R0, ZERO, IMM(0);  // output = 0
    }

    // Control @0,0, body @1,0 (adjacent → uses RCR)
    while (R0 < IMM(10)) @0,0 {
        cycle {
            @1,0: SADD R0, R0, IMM(1);  // output = new value
        }
    }

    cycle {
        @1,0: ASSERT R0, 10;
    }
    cycle {
        @0,0: EXIT;
    }
}
```

**Cycles:** ~25 (vs ~33 for same-PE)

## Generated Code

```
Cycle 0:  _ | SADD R0,ZERO,0 | _ | _     ← Init @1,0 (output=0)
Cycle 1:  BGE RCR,10,exit | _ | _ | _    ← Condition reads neighbor
Cycle 2:  JUMP 0,0,1 | SADD R0,R0,1      ← FUSED: body + jump
Cycle 3:  BGE RCR,10,exit | _ | _ | _    ← Reads 1 from neighbor
Cycle 4:  JUMP 0,0,1 | SADD R0,R0,1      ← R0=2, output=2
...
Cycle 21: BGE RCR,10,exit | _ | _ | _    ← Reads 10 (10>=10, exit!)
Cycle 22: _ | ASSERT R0,10 | _ | _
Cycle 23: EXIT | _ | _ | _
```

## Neighbor Reference Table

| Body PE | Control PE | Neighbor |
|---------|------------|----------|
| @1,0 | @0,0 | RCR |
| @0,0 | @1,0 | RCL |
| @0,0 | @0,1 | RCT |
| @0,1 | @0,0 | RCB |

## Sum with Adjacent PEs

```c
kernel "SumRange_Optimized" {
    config(0xF, 0);

    // Counter at control PE, accumulator at body PE
    cycle {
        @1,0: SADD R0, ZERO, IMM(0);  // Counter at @1,0
        @0,0: SADD R1, ZERO, IMM(0);  // Accumulator at @0,0
    }

    // Control @1,0, body @0,0 (adjacent → uses RCL)
    while (R0 < IMM(10)) @1,0 {
        cycle {
            @1,0: SADD R0, R0, IMM(1);  // counter++ (at control PE)
            @0,0: SADD R1, R1, RCL;     // sum += counter (via RCL)
        }
    }

    cycle {
        @1,0: EXIT;
    }
}
// Note: Result should be R1=55 at @0,0 (sum of 1-10)
```

## Multi-Instruction Body (No Fusion)

When body has multiple instructions in same cycle, fusion is disabled but neighbor ref still works:

```c
while (R0 <= IMM(5)) @0,3 {
    cycle {
        @0,2: SADD R0, R0, IMM(1);   // Counter
        @0,1: SADD R0, R0, RCB;      // Accumulator reads counter
    }
}
// Uses RCT (first instruction's PE relative to control)
// 3 cycles/iter (no fusion due to multiple instructions)
```

## Bottom Row Control

<!-- expect: R0@0,2=5 -->
```c
kernel "Sum_Bottom_Control" {
    config(0xF, 0);

    // Note: One instruction per PE per cycle
    cycle {
        @0,2: SADD R0, ZERO, IMM(0);   // counter at row 2
    }
    cycle {
        @0,2: SADD R1, ZERO, IMM(0);   // sum at row 2
    }

    // Control @0,3 (bottom), Body @0,2 (above) → uses RCT
    while (R0 < IMM(5)) @0,3 {
        cycle {
            @0,2: SADD R0, R0, IMM(1);
        }
    }

    cycle {
        @0,2: ASSERT R0, 5;
    }
    cycle {
        @0,3: EXIT;
    }
}
```

---

## Navigation

- [← Examples Index](../README.md)
- [Main Index](../../README.md)
