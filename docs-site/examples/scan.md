---
title: Scan & Broadcast
outline: deep
---

# Scan & Broadcast

Examples demonstrating prefix-sum (scan) and broadcast patterns.

## Prefix Sum

Compute inclusive prefix sum across a row using `#pragma scan`:

```c
kernel "PrefixSum" {
    config(0xF, 0);

    // Initialize: each PE gets value 1
    #pragma parallel
    for j in range(4) {
        cycle {
            @0,j: SADD R0, ZERO, IMM(1);
        }
    }

    // Prefix sum across row
    #pragma scan(sum, R0, R1, direction=right)

    cycle { @0,0: EXIT; }
}
```

**Expected:** PE(0,0)=1, PE(0,1)=2, PE(0,2)=3, PE(0,3)=4

---

## Broadcast

Broadcast a value from one PE to all others using `#pragma broadcast`:

```c
kernel "Broadcast" {
    config(0xF, 0);

    // Only PE(0,0) has the value
    cycle {
        @0,0: SADD R0, ZERO, IMM(42);
    }

    // Broadcast R0 from PE(0,0) to all PEs
    #pragma broadcast(R0, R1, source=(0,0))

    cycle { @0,0: EXIT; }
}
```

**Expected:** R1 = 42 in all PEs
