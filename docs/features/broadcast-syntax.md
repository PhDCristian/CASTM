# Broadcast Syntax

[← C-like Expressions](clike-expressions.md) | [Main Index](../README.md)

---

Broadcast syntax provides shorthand for applying the same instruction to multiple PEs without repetition.

## Syntax

Inside a `cycle { }` block:

```c
cycle {
    all: INSTRUCTION;          // All 16 PEs (4 rows × 4 columns)
    row N: INSTRUCTION;        // All 4 columns in row N (broadcast, no pipes)
    col N: INSTRUCTION;        // All 4 rows in column N
}
```

---

## Before vs After

### Without broadcast (repetitive)

```c
// dot-product.dsl — same SMUL repeated 4 times
cycle {
    @0,0: SMUL R2, R0, R1;
    @0,1: SMUL R2, R0, R1;
    @0,2: SMUL R2, R0, R1;
    @0,3: SMUL R2, R0, R1;
}
```

### With broadcast (concise)

```c
cycle {
    row 0: SMUL R2, R0, R1;    // Same instruction to all 4 columns
}
// or even more concise for all 16 PEs:
cycle {
    all: SMUL R2, R0, R1;
}
```

---

## `all:` — All 16 PEs

Replicates the instruction to every PE in the grid:

```c
cycle {
    all: SADD R0, ZERO, IMM(1);
}
// Equivalent to:
cycle {
    @0,0: SADD R0, ZERO, IMM(1);
    @0,1: SADD R0, ZERO, IMM(1);
    @0,2: SADD R0, ZERO, IMM(1);
    @0,3: SADD R0, ZERO, IMM(1);
    @1,0: SADD R0, ZERO, IMM(1);
    // ... all 16 PEs
}
```

---

## `row N:` — Row Broadcast

When `row N:` is followed by a single instruction (no `|` pipes), it broadcasts to all 4 columns:

```c
cycle {
    row 0: SADD R0, ZERO, IMM(42);   // Broadcast: all 4 cols get same instruction
}
```

**Pipe syntax still works** for per-column differentiation:

```c
cycle {
    row 0: SADD R0, ZERO, IMM(10) | SADD R0, ZERO, IMM(20) | SADD R0, ZERO, IMM(30) | SADD R0, ZERO, IMM(40);
}
```

The key difference:
- **With pipes (`|`)**: Each column gets a different instruction
- **Without pipes**: All columns get the same instruction (broadcast)

---

## `col N:` — Column Broadcast

Replicates to all 4 rows in column N:

```c
cycle {
    col 2: SADD R0, ZERO, IMM(55);
}
// Equivalent to:
cycle {
    @0,2: SADD R0, ZERO, IMM(55);
    @1,2: SADD R0, ZERO, IMM(55);
    @2,2: SADD R0, ZERO, IMM(55);
    @3,2: SADD R0, ZERO, IMM(55);
}
```

---

## Combining Broadcast Styles

Different broadcast styles can be combined in the same cycle:

```c
cycle {
    row 0: SADD R0, ZERO, IMM(1);   // Row 0: all cols
    row 1: SADD R0, ZERO, IMM(2);   // Row 1: all cols
    col 3: SADD R1, ZERO, IMM(99);  // Col 3: all rows (may override row 0/1 at PE(0,3) and PE(1,3))
}
```

---

## Example: Dot Product

```c
.data A { 1, 2, 3, 4 }
.data B { 5, 6, 7, 8 }
kernel "DotProduct" {
    config(0xF, 0);
    #pragma parallel
    for i in range(4) {
        cycle { @0,i: LWI R0, A[i]; }
    }
    #pragma parallel
    for i in range(4) {
        cycle { @0,i: LWI R1, B[i]; }
    }
    cycle {
        row 0: SMUL R2, R0, R1;    // All 4 columns multiply in parallel
    }
    #pragma reduce(sum, R3, R2)
    cycle { @0,0: EXIT; }
}
// Result: PE(0,0).R3 = 1*5 + 2*6 + 3*7 + 4*8 = 70
```

---

## Navigation

- [← C-like Expressions](clike-expressions.md)
- [Main Index](../README.md)
