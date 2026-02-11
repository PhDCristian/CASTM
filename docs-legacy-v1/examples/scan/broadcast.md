# Example: Row Broadcast

[← Examples Index](../README.md) | [Main Index](../../README.md)

---

Broadcast a value from one PE to all PEs in the same row.

## Row Broadcast

<!-- Verified: #pragma broadcast is implemented -->
```c
kernel "RowBroadcast" {
    config(0xF, 0);

    // Load initial value only in PE[0,0]
    cycle { @0,0: SADD R0, ZERO, IMM(42); }

    // Broadcast to entire row 0
    #pragma broadcast(value=R0, from=@0,0, to=row)

    // Store from all columns to verify
    #pragma parallel
    for i in range(4) {
        cycle { @0,0: SWI R0, 100+i*4; }
    }

    cycle { @0,0: EXIT; }
}
```

## Expected Results

| Address | Value | Description |
|---------|-------|-------------|
| 100 | 42 | PE[0,0] |
| 104 | 42 | PE[0,1] |
| 108 | 42 | PE[0,2] |
| 112 | 42 | PE[0,3] |

## How It Works

```
Cycle 1: PE[0,0] sends R0=42 via ROUT
Cycle 2: PE[0,1] receives from RCL, R0=42, forwards via ROUT
Cycle 3: PE[0,2] receives from RCL, R0=42, forwards via ROUT
Cycle 4: PE[0,3] receives from RCL, R0=42
```

---

## Column Broadcast

<!-- Verified: #pragma broadcast is implemented -->
```c
kernel "ColumnBroadcast" {
    config(0xF, 0);

    // Load value only in PE[0,0]
    cycle { @0,0: SADD R0, ZERO, IMM(99); }

    // Broadcast down column 0
    #pragma broadcast(value=R0, from=@0,0, to=column)

    // Store from all rows to verify
    cycle { @0,0: SWI R0, 100; }
    cycle { @1,0: SWI R0, 104; }
    cycle { @2,0: SWI R0, 108; }
    cycle { @3,0: SWI R0, 112; }

    cycle { @0,0: EXIT; }
}
```

**Expected:** All addresses contain 99.

---

## Navigation

- [← Examples Index](../README.md)
- [Main Index](../../README.md)
