# Spatial-Temporal Domain

[← Program Structure](02-program-structure.md) | [Index](../README.md) | [Next: Instruction Set →](04-instruction-set.md)

---

## Cycle Definition (Temporal Domain)

The `cycle` keyword defines a single time step (or a block of parallel operations). Cycles are **auto-incremental** starting from 0.

### Labels (Jump Targets)

Any cycle can be preceded by a label ending in a colon `:`. The compiler resolves this label to the absolute cycle number.

```c
init_loop:
cycle {
    // ...
}
```

---

## Row/Column Definition (Spatial Domain)

Inside a `cycle` block, you can define operations using three different styles. These styles can be mixed within the same kernel (but not within the same cycle for the same row).

---

### Style A: Visual Pipe (Dense Dataflow)

Best for rows where data flows horizontally or most PEs are active.

**Syntax:** `row <n>: <Col0> | <Col1> | <Col2> | <Col3>;`

**Empty Token:** Use `_` (underscore) to represent a `NOP`.

```c
cycle {
    // Visually aligns the data path
    row 0: LWD R0, SELF | _ | SMUL R2, RCL, R1 | _;
}
```

**Advantages:**
- Visual representation of data flow
- Easy to see which PEs are active
- Compact for dense operations

---

### Style B: Structural Block (Sparse Control)

Best for sparse operations where only specific PEs are active.

**Syntax:** `row <n> { col <i>: <INSTR>; ... }`

```c
cycle {
    row 1 {
        col 0: SADD ROUT, R0, ZERO;
        // Cols 1, 2, 3 are implicitly NOP
        col 3: EXIT;
    }
}
```

**Advantages:**
- Only specify active PEs
- Better for control-heavy code
- Cleaner when most PEs are idle

---

### Style C: Direct Coordinate (Point Operations)

Best for single-instruction fixes or very sparse kernels.

**Syntax:** `@<row>,<col>: <INSTR>;`

```c
cycle {
    @2,1: SADD R1, R1, R2;
}
```

**Advantages:**
- Most precise control
- Best for single-PE operations
- Required for some advanced features (while loops, parallel pragmas)

---

## Mixing Styles

You can mix styles within the same kernel, but not within the same cycle for the same row:

```c
kernel "MixedStyles" {
    config(0xF, 0);

    // Cycle 0: Visual pipe style
    cycle {
        row 0: LWD R0 | LWD R1 | _ | _;
    }

    // Cycle 1: Structural block style
    cycle {
        row 0 {
            col 0: SADD ROUT, R0, R1;
        }
    }

    // Cycle 2: Direct coordinate style
    cycle {
        @0,0: SWD ROUT;
        @3,0: EXIT;
    }
}
```

---

## Style Comparison

| Style | Best For | Syntax | Implicit NOPs |
|-------|----------|--------|---------------|
| Visual Pipe | Dense dataflow | `row N: A \| B \| C \| D;` | Use `_` |
| Structural | Sparse control | `row N { col M: ... }` | Yes |
| Direct | Single PE ops | `@row,col: ...` | Yes |

---

## Navigation

- [← Program Structure](02-program-structure.md)
- [Index](../README.md)
- [Next: Instruction Set →](04-instruction-set.md)
