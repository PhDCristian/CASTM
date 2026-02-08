# Pragma Auto Cycle

[← Stream](stream.md) | [Main Index](../../README.md)

---

The `#pragma auto_cycle` / `#pragma end_auto_cycle` directives eliminate the need to write explicit `cycle { }` wrappers. The compiler automatically infers cycle boundaries based on PE coordinate conflicts.

## Syntax

```c
#pragma auto_cycle
// Instructions with PE prefixes (no cycle { } needed)
@0,0: instr;
@0,1: instr;
...
#pragma end_auto_cycle
```

---

## Before vs After

### Without auto_cycle (verbose)

```c
cycle { @0,0: LWI R0, A[0]; @0,1: LWI R0, A[1]; }
cycle { @0,0: LWI R1, B[0]; @0,1: LWI R1, B[1]; }
cycle { all: SMUL R2, R0, R1; }
```

### With auto_cycle (clean)

```c
#pragma auto_cycle
@0,0: LWI R0, A[0];
@0,1: LWI R0, A[1];
@0,0: LWI R1, B[0];
@0,1: LWI R1, B[1];
all: SMUL R2, R0, R1;
#pragma end_auto_cycle
```

---

## Grouping Rules

The compiler groups consecutive instructions into cycles using these rules:

1. **No conflict**: Instructions targeting different PEs go in the **same cycle**
2. **Conflict**: When a PE coordinate is already used in the current group, a **new cycle** starts
3. **`all:` and `row N:`**: These occupy multiple PEs, so they cause conflicts with any overlapping PE

### Examples

```c
#pragma auto_cycle

// Cycle 1: @0,0 and @0,1 are different PEs → same cycle
@0,0: LWI R0, A[0];
@0,1: LWI R0, A[1];

// Cycle 2: @0,0 already in cycle 1 → new cycle
@0,0: LWI R1, B[0];
@0,1: LWI R1, B[1];

// Cycle 3: all: occupies all 16 PEs → new cycle
all: SMUL R2, R0, R1;

#pragma end_auto_cycle
```

### Row/Column Prefixes

```c
#pragma auto_cycle

// Cycle 1: row 0 (PEs 0,0-0,3) and row 1 (PEs 1,0-1,3) — no conflict
row 0: SADD R0, ZERO, IMM(1);
row 1: SADD R0, ZERO, IMM(2);

// Cycle 2: row 0 conflicts with cycle 1
row 0: SADD R1, ZERO, IMM(3);

#pragma end_auto_cycle
```

---

## Supported Prefixes

| Prefix | PEs Occupied |
|--------|-------------|
| `@row,col:` | 1 PE |
| `row N:` | 4 PEs (columns 0-3 in row N) |
| `col N:` | 4 PEs (rows 0-3 in column N) |
| `all:` | 16 PEs (entire grid) |

---

## Mixing with Regular Code

Auto-cycle regions can be freely mixed with regular `cycle { }` blocks:

```c
kernel "Mixed" {
    config(0xF, 0);

    // Regular cycle block
    cycle {
        @0,0: SADD R0, ZERO, IMM(100);
    }

    // Auto-cycle region
    #pragma auto_cycle
    @0,0: SADD R1, ZERO, IMM(200);
    @0,1: SADD R1, ZERO, IMM(300);
    #pragma end_auto_cycle

    cycle { @0,0: EXIT; }
}
```

---

## Implementation

Auto-cycle is implemented as a **token-level pass** that runs before parsing. It:

1. Finds `#pragma auto_cycle` ... `#pragma end_auto_cycle` regions
2. Detects instruction prefixes and their PE coordinates
3. Groups non-conflicting instructions into the same cycle
4. Inserts `cycle { }` wrapper tokens around each group

This means the feature is fully transparent to the parser and compatible with all other features.

---

## Limitations

1. **Requires PE prefixes**: Every instruction inside the region must have a PE prefix (`@r,c:`, `row N:`, `col N:`, or `all:`)
2. **No nested regions**: Cannot nest `#pragma auto_cycle` inside another
3. **Must be closed**: `#pragma end_auto_cycle` is required (error if missing)
4. **Token-level only**: Does not understand data dependencies — grouping is purely based on PE coordinate conflicts

---

## Navigation

- [← Stream](stream.md)
- [Main Index](../../README.md)
