# Compilation Rules (DSL to CSV)

[← Instruction Set](04-instruction-set.md) | [Index](../README.md) | [Next: Features →](../features/README.md)

---

The compiler performs a 2-pass process to transform DSL source code into the target CSV format.

## Pass 1: Symbol Resolution

1. Initialize `cycle_counter = 0`.
2. Parse line by line.
3. Record `.const` and `.alias` definitions.
4. When a `label:` is encountered, store `{ label_name: cycle_counter }` in the Symbol Table.
5. When a `cycle` block closes, increment `cycle_counter`.

## Pass 2: Code Generation

1. Reset `cycle_counter = 0`.
2. For each `cycle` block:
   * Initialize a 4x4 grid of `NOP` instructions.
   * **Visual Pipe:** Parse `row r: c0 | c1 | c2 | c3`. Fill grid `(r, 0..3)`. Replace `_` with `NOP`.
   * **Structural:** Parse `row r { col c: ... }`. Fill specific grid cells.
   * **Direct:** Parse `@c,r: ...`. Fill specific grid cell.
   * **Instruction Translation:**
     * Replace Aliases with Registers (`r_acc` -> `R3`).
     * Replace Constants with Values (`.THRESHOLD` -> `100`).
     * Replace Labels with Cycle Numbers (`end_loop` -> `15`).
   * **Emit CSV:** Generate 16 lines (one per PE) for the current cycle:
     `cycle_counter, row, col, "INSTRUCTION"`
3. Increment `cycle_counter`.

---

## Safety Mechanisms

### Implicit Exit

If no `EXIT` instruction is detected in the entire kernel after compilation, the compiler must automatically append a new cycle containing `EXIT` at `@0,0` to prevent infinite simulation loops.

**Example:**

```c
// Source (no EXIT)
kernel "NoExit" {
    config(0xF, 0);
    cycle {
        row 0: SADD R0, R0, IMM(1) | _ | _ | _;
    }
}

// Compiled output includes auto-generated exit:
// Cycle 0: SADD R0, R0, 1 | NOP | NOP | NOP
// Cycle 1 (auto): EXIT | NOP | NOP | NOP (all rows)
```

---

## CSV Output Format

The generated CSV has the following structure:

```csv
cycle,row,col,instruction
0,0,0,"SADD R0, R0, 1"
0,0,1,"NOP"
0,0,2,"NOP"
0,0,3,"NOP"
0,1,0,"NOP"
...
1,0,0,"EXIT"
...
```

Each row represents one PE at one cycle, with 16 rows per cycle (4 rows × 4 columns).

---

## Navigation

- [← Instruction Set](04-instruction-set.md)
- [Index](../README.md)
- [Next: Features →](../features/README.md)
