# Labels

Labels attach a symbolic name to a statement so it can serve as a **jump target** for runtime branching. Any compound statement that expands into one or more cycles can receive a label; the compiler attaches the label to the **first emitted cycle** of the expansion.

## Syntax

```text
label: statement
```

Where `statement` is one of:

- A `bundle { ... }` block
- An advanced statement (`std::*`)
- A function call
- A control-flow block (`for`, `if`, `while`)

## Supported Forms

```text
// Labeled cycle block
mainEntry: bundle { at all: LWI R0, 0; }

// Labeled advanced statement
subrC: std::extract_bytes(src=R0, dest=R1, axis=col, byteWidth=8, mask=255);

// Labeled function call
loadPhase: loadValues(R0, 720);
```

## Semantics

1. The label is a valid identifier (`[A-Za-z_][A-Za-z0-9_]*`).
2. Reserved keywords (`cycle`, `if`, `while`, `for`, `break`, `continue`, `at`, `pipeline`, `target`, `kernel`, `let`) **cannot** be used as labels.
3. When the labeled statement expands into cycles, the label is assigned to the **first generated cycle**.
4. Labels are used by `JUMP` instructions in the jump-reuse expansion mode for subroutine call/return.

## Integration with Jump-Reuse

In `expansion_mode "jump-reuse"`, labeled statements define subroutine entry points:

```castm
target base;

function mySubroutine(dst) {
  bundle { at all: SADD dst, dst, ZERO; }
}

kernel "label_fn_demo" {
  init: bundle { at all: LWI R0, 42; }
  subrEntry: mySubroutine(R0);
  bundle { @0,0: EXIT; }
}
```

## Grammar

```text
labeled_stmt ::= label ":" (cycle_block | advanced_stmt | function_call | for_stmt | if_stmt | while_stmt)
label        ::= ident
```
