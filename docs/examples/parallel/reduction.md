# Example: Reduction

[← Examples Index](../README.md) | [Main Index](../../README.md)

---

Tree reduction patterns for sum and max.

## Sum Reduction

<!-- TODO: #pragma reduce has a known issue in this configuration - expected 100 -->
```c
.data 0 { 10, 20, 30, 40 }

kernel "SumReduce" {
    config(0xF, 0);

    // Load in parallel
    #pragma parallel
    for i in range(4) {
        cycle { @0,0: LWI R0, data[i]; }
    }

    // Reduce: 10 + 20 + 30 + 40 = 100
    #pragma reduce(sum, R0, ROUT)

    cycle { @0,0: SWD ROUT; }
    cycle { @0,0: EXIT; }
}
```

## Compiled Output

```c
// Cycle 0: Parallel load
row 0: LWI R0, 0 | LWI R0, 4 | LWI R0, 8 | LWI R0, 12;

// Cycle 1: Pairwise sum
row 0: SADD R2, R0, RCR | NOP | SADD R2, R0, RCR | NOP;
// Col 0: R2 = 10 + 20 = 30
// Col 2: R2 = 30 + 40 = 70

// Cycle 2: Relay through Col 1
row 0: NOP | SADD R3, RCR, ZERO | NOP | NOP;
// Col 1: R3 = 70 (from Col 2)

// Cycle 3: Final sum
row 0: SADD ROUT, R2, RCR | NOP | NOP | NOP;
// Col 0: ROUT = 30 + 70 = 100

// Cycle 4-5: Store and exit
```

**Result:** 100 at column 0

## Max Reduction

<!-- TODO: #pragma reduce(max) has a known issue - expected 42 -->
```c
.data 0 { 15, 42, 8, 27 }

kernel "MaxReduce" {
    config(0xF, 0);

    #pragma parallel
    for i in range(4) {
        cycle { @0,0: LWI R0, data[i]; }
    }

    #pragma reduce(max, R0, ROUT)

    cycle { @0,0: SWD ROUT; }
    cycle { @0,0: EXIT; }
}
```

**Result:** 42 (maximum value)

## Min Reduction

```c
#pragma reduce(min, R0, ROUT)
```

## Bitwise Reductions

```c
#pragma reduce(and, R0, ROUT)  // Bitwise AND
#pragma reduce(or, R0, ROUT)   // Bitwise OR
```

## Combined: Sum of Squares

<!-- TODO: #pragma reduce has a known issue - expected 30 -->
```c
.data 0 { 1, 2, 3, 4 }

kernel "SumOfSquares" {
    config(0xF, 0);

    // Load and square in parallel
    #pragma parallel
    for i in range(4) {
        cycle { @0,0: LWI R0, data[i]; }
        cycle { @0,0: SMUL R0, R0, R0; }  // R0 = R0²
    }

    // Reduce: 1 + 4 + 9 + 16 = 30
    #pragma reduce(sum, R0, ROUT)

    cycle { @0,0: SWD ROUT; }
    cycle { @0,0: EXIT; }
}
```

## Wave + Reduction

For more than 4 elements:

<!-- expect: memory[0]=36 -->
```c
.data 0 { 1, 2, 3, 4, 5, 6, 7, 8 }

kernel "SumEight" {
    config(0xF, 0);

    // Initialize accumulators
    cycle {
        row 0: SADD R1, ZERO, ZERO | SADD R1, ZERO, ZERO |
               SADD R1, ZERO, ZERO | SADD R1, ZERO, ZERO;
    }

    // Wave 0: i=0,1,2,3
    #pragma parallel
    for i in range(4) {
        cycle { @0,0: LWI R0, data[i]; }
        cycle { @0,0: SADD R1, R1, R0; }
    }

    // Wave 1: i=4,5,6,7
    #pragma parallel
    for i in range(4, 8) {
        cycle { @0,0: LWI R0, data[i]; }
        cycle { @0,0: SADD R1, R1, R0; }
    }

    // Reduce column totals
    #pragma reduce(sum, R1, ROUT)

    cycle { @0,0: SWD ROUT; }
    cycle { @0,0: EXIT; }
}
// Result: 1+2+3+4+5+6+7+8 = 36
```

## Cycle Counts

| Operation | Cycles |
|-----------|--------|
| sum | 3 |
| and | 3 |
| or | 3 |
| max | 4 |
| min | 4 |

---

## Navigation

- [← Examples Index](../README.md)
- [Main Index](../../README.md)
