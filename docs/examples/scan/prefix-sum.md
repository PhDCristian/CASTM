# Example: Prefix Sum

[← Examples Index](../README.md) | [Main Index](../../README.md)

---

Compute inclusive prefix sum across columns using `#pragma scan`.

## Prefix Sum

<!-- TODO: #pragma scan not yet implemented -->
```c
.data 0 { 1, 2, 3, 4 }

kernel "PrefixSum" {
    config(0xF, 0);

    // Load values: Col0=1, Col1=2, Col2=3, Col3=4
    #pragma parallel
    for i in range(4) {
        cycle { @0,0: LWI R0, data[i]; }
    }

    // Inclusive prefix sum: [1, 3, 6, 10]
    #pragma scan(add, R0, R1, right)

    // Store results
    #pragma parallel
    for i in range(4) {
        cycle { @0,0: SWI R1, 100+i*4; }
    }

    cycle { @0,0: EXIT; }
}
```

## Expected Results

| Column | Input (R0) | Output (R1) | Formula |
|--------|------------|-------------|---------|
| 0 | 1 | 1 | 1 |
| 1 | 2 | 3 | 1+2 |
| 2 | 3 | 6 | 1+2+3 |
| 3 | 4 | 10 | 1+2+3+4 |

## How It Works

The scan propagates from left to right:

```
Step 1: PE[0] initializes R1 = R0 = 1
Step 2: PE[0] sends 1 → PE[1] receives, R1 = R0 + 1 = 2 + 1 = 3
Step 3: PE[1] sends 3 → PE[2] receives, R1 = R0 + 3 = 3 + 3 = 6
Step 4: PE[2] sends 6 → PE[3] receives, R1 = R0 + 6 = 4 + 6 = 10
```

---

## Running Maximum

<!-- TODO: #pragma scan not yet implemented -->
```c
.data 0 { 3, 7, 2, 9 }

kernel "RunningMax" {
    config(0xF, 0);

    #pragma parallel
    for i in range(4) {
        cycle { @0,0: LWI R0, data[i]; }
    }

    // Running max: [3, 7, 7, 9]
    #pragma scan(max, R0, R1, right)

    #pragma parallel
    for i in range(4) {
        cycle { @0,0: SWI R1, 100+i*4; }
    }

    cycle { @0,0: EXIT; }
}
```

**Expected:** Col0=3, Col1=7, Col2=7, Col3=9

---

## Navigation

- [← Examples Index](../README.md)
- [Main Index](../../README.md)
