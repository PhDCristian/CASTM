# Pragma Broadcast

[← Scan](scan.md) | [Main Index](../../README.md)

---

The `#pragma broadcast` directive distributes a value from one PE to multiple PEs, propagating through the toroidal mesh.

## Syntax

```c
#pragma broadcast(value=srcReg, from=@row,col, to=scope)
```

| Parameter | Values | Description |
|-----------|--------|-------------|
| `value` | R0-R3, ROUT | Register to broadcast |
| `from` | `@row,col` | Source PE coordinates |
| `to` | `row`, `column`, `all` | Target scope |

---

## Scope Options

| Scope | Description | Cycles |
|-------|-------------|--------|
| `row` | All PEs in the same row | 3 |
| `column` | All PEs in the same column | 3 |
| `all` | All 16 PEs (row first, then column) | 6 |

---

## Examples

### Row Broadcast

```c
kernel "RowBroadcast" {
    config(0xF, 0);

    // Load value only in PE[0,0]
    cycle { @0,0: SADD R0, ZERO, IMM(42); }

    // Broadcast to entire row 0
    #pragma broadcast(value=R0, from=@0,0, to=row)

    // Now all PEs in row 0 have R0=42
    cycle { @0,0: EXIT; }
}
```

### Column Broadcast

```c
kernel "ColumnBroadcast" {
    config(0xF, 0);

    // Load value in PE[0,0]
    cycle { @0,0: LWI R0, 0; }

    // Broadcast down column 0
    #pragma broadcast(value=R0, from=@0,0, to=column)

    // Now PE[0,0], PE[1,0], PE[2,0], PE[3,0] all have the same R0
    cycle { @0,0: EXIT; }
}
```

### Full Grid Broadcast

```c
kernel "GridBroadcast" {
    config(0xF, 0);

    // Load constant only in one PE
    cycle { @0,0: SADD R0, ZERO, IMM(255); }

    // Broadcast to all 16 PEs
    #pragma broadcast(value=R0, from=@0,0, to=all)

    // All PEs now have R0=255
    cycle { @0,0: EXIT; }
}
```

---

## Generated Code

### Row Broadcast (from @0,0)

```c
// Input:
#pragma broadcast(value=R0, from=@0,0, to=row)

// Generated:
cycle { @0,0: SADD ROUT, R0, ZERO; }               // Send right
cycle { @0,1: SADD R0, RCL, ZERO; @0,1: SADD ROUT, R0, ZERO; }  // Receive, forward
cycle { @0,2: SADD R0, RCL, ZERO; @0,2: SADD ROUT, R0, ZERO; }  // Receive, forward
cycle { @0,3: SADD R0, RCL, ZERO; }                // Final receive
```

### Column Broadcast (from @0,0)

```c
// Input:
#pragma broadcast(value=R0, from=@0,0, to=column)

// Generated:
cycle { @0,0: SADD ROUT, R0, ZERO; }               // Send down
cycle { @1,0: SADD R0, RCT, ZERO; @1,0: SADD ROUT, R0, ZERO; }  // Receive, forward
cycle { @2,0: SADD R0, RCT, ZERO; @2,0: SADD ROUT, R0, ZERO; }  // Receive, forward
cycle { @3,0: SADD R0, RCT, ZERO; }                // Final receive
```

---

## Use Cases

### 1. Constant Distribution

Load a constant once and share with all PEs:

```c
// Load from memory once
cycle { @0,0: LWI R0, CONST_ADDR; }

// Share with all
#pragma broadcast(value=R0, from=@0,0, to=all)

// All PEs can now use R0
```

### 2. After Reduction

After a reduce operation, broadcast the result back:

```c
// Reduce sum to column 0
#pragma reduce(sum, R0, ROUT)

// Broadcast result to all columns
#pragma broadcast(value=ROUT, from=@0,0, to=row)
```

### 3. Threshold Distribution

Share a comparison threshold with all PEs:

```c
cycle { @0,0: SADD R3, ZERO, IMM(100); }  // Threshold = 100
#pragma broadcast(value=R3, from=@0,0, to=row)

// Now all PEs can compare against R3
#pragma parallel
for i in range(4) {
    cycle { @0,0: SSUB R2, R0, R3; }  // Compare with threshold
}
```

---

## Cycle Count

| Scope | Cycles |
|-------|--------|
| `row` | 3 (propagate to 3 neighbors) |
| `column` | 3 (propagate to 3 neighbors) |
| `all` | 6 (row + column) |

---

## Comparison with Other Pragmas

| Pragma | Pattern | Use Case |
|--------|---------|----------|
| `broadcast` | One → Many | Data distribution |
| `reduce` | Many → One | Aggregation |
| `scan` | Many → Many (prefix) | Running totals |
| `route` | One → One | Point-to-point |

---

## Limitations

1. **Uses ROUT**: The ROUT register is overwritten during propagation
2. **Sequential propagation**: Each hop takes one cycle
3. **Source PE unchanged**: The source PE retains its original value

---

## Navigation

- [← Scan](scan.md)
- [Main Index](../../README.md)
