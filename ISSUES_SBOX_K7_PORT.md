# OpenEdgeDSL Compiler Issues — Discovered During SBOX K7 v6 Porting

Discovered while porting `sbox_k7_v5_rout.edsl` → `sbox_k7_v6_compact.edsl`.

---

## Issue 1: `all:` keyword label-prefixed inside functions

**Symptom:** `all: SADD R0, ZERO, IMM(99);` inside a function body causes:
```
Unexpected token inside cycle: _load_all_0_all
```

**Root cause:** The function expansion prefixes all tokens with `_funcname_N_` to avoid label collisions. The keyword `all` gets treated as a label → `_load_all_0_all` instead of being recognized as the broadcast keyword.

**Workaround:** Use 4× `row N:` with pipes instead of `all:` inside function bodies.

**Impact:** `all:` broadcast is unusable inside functions — one of the most common use cases.

---

## Issue 2: C-like expression `R3 = ZERO` not recognized

**Symptom:**
```
Expected SEMICOLON, but found IDENTIFIER('ZERO')
```

**Root cause:** The expression desugar handles `R3 = R2` → `SADD R3, R2, ZERO` but doesn't recognize `ZERO` as a valid source operand for simple copy. The desugar docs list `ZERO` as a valid operand, but the implementation doesn't handle it.

**Workaround:** Write `SADD R3, ZERO, ZERO;` in assembly syntax.

---

## Issue 3: C-like expressions fail in multi-`@` cycle blocks

**Symptom:**
```
Expected SEMICOLON, but found IDENTIFIER('R2')
```
when writing `@0,0: R3 = R2; @0,1: R3 = R2;` inside a cycle.

**Root cause:** The expression desugarer doesn't parse C-like expressions when multiple `@row,col:` instructions coexist on the same line separated by `;`.

**Workaround:** Use assembly syntax (`SADD R3, R2, ZERO`) for all instructions in multi-`@` cycle blocks.

**Impact:** C-like expressions are essentially limited to single-PE-per-line cycle blocks, heavily restricting their usefulness in real kernels.

---

## Issue 4: C-like expressions fail inside `row N:` pipe syntax

**Symptom:** `row 0: R3 = R2 | SADD R3, R2, RCL | ...` fails because `|` is ambiguous between the pipe separator and the C-like bitwise OR operator context.

**Root cause:** The desugar runs before pipe splitting, so it can't distinguish the `|` pipe separator from a potential bitwise OR in C-like expressions.

**Workaround:** Use assembly syntax for any instruction inside a `row N:` pipe-separated line.

---

## Issue 5: `row N:` single-instruction broadcast doesn't replicate to all columns

**Symptom:** `row 0: LWI R0, 720;` only fills **column 0**, leaving columns 1-3 as NOP.

**Expected:** The broadcast syntax documentation says `row N:` should replicate the instruction to all 4 columns of that row, analogous to `all:` replicating to all 16 PEs.

**Actual CSV output:**
```csv
// v6 (broken): single-instruction row broadcast
"LWI R0, 720", NOP, NOP, NOP

// v5 (correct): explicit pipes
"LWI R0, 720", "LWI R0, 720", "LWI R0, 720", "LWI R0, 720"
```

**Root cause:** `row N:` without pipes is treated as shorthand for `@N,0:` (only column 0), not as a broadcast to all 4 columns. Only when pipe syntax is used (`row N: X | X | X | X`) does it fill all columns.

**Impact:** This means `row N:` is not a true broadcast—it's just a row-aware coordinate specifier. The documentation is misleading.

**Workaround:** Always use full pipe syntax: `row N: X | X | X | X;`

---

## Issue 6: `for` loops not supported inside `cycle { }`

**Symptom:**
```
Unexpected token inside cycle: for
```
when writing `cycle { for i in range(4) { row i: LWI R0, addr | ...; } }`

**Root cause:** The cycle parser doesn't recognize `for` as a valid token inside a `cycle { }` block. `for` loops can only *wrap* `cycle` blocks, not appear inside them.

**Expected:** `for i in range(4)` inside a cycle would unroll and insert 4 row instructions in the same cycle, enabling compact multi-row patterns.

**Impact:** Cannot use `for` loops to reduce repetitive `row 0: / row 1: / row 2: / row 3:` patterns within a single cycle. Must write all 4 rows explicitly.

**Workaround:** Use `for` wrapping cycles (each iteration creates a separate cycle) or write rows explicitly.

---

## Issue 7: `#pragma auto_cycle` doesn't work inside functions

**Symptom:** `#pragma auto_cycle` inside function bodies causes:
```
Expected KEYWORD('cycle'), but found AT_SYMBOL('@')
```

**Root cause:** Same as Issue 1 — function expansion prefixes tokens with `_funcname_N_` before `auto_cycle` processing. The auto_cycle pass can't find PE prefixes (`@row,col:`) after they've been mangled.

**Note:** `#pragma route` and `#pragma parallel` DO work inside functions. Only `auto_cycle` is affected.

**Workaround:** Use `auto_cycle` only at the kernel level, or write explicit `cycle { }` wrappers inside functions.

---

## Issue 8: `#pragma parallel` (without `collapse`) generates serial cycles

**Symptom:** `#pragma parallel for c in range(4) { cycle { @0,c: INSTR; } }` generates **4 separate cycles** (one INSTR per column per cycle) instead of 1 cycle with all 4 columns active simultaneously.

**Expected:** All 4 iterations should be merged into a single cycle (wave-based parallelism as described in docs).

**Actual:** Iterations are serialized — each gets its own cycle, placed only in its assigned column.

**Fix:** Use `#pragma parallel collapse` with dynamic coordinates `@i,j:` for true parallelism:
```c
#pragma parallel collapse
for i in range(4) {
    for j in range(4) {
        cycle { @i,j: LWI R0, addr; }  // All 16 PEs in 1 cycle
    }
}
```

**Impact:** The `collapse` modifier is essential for actual parallel execution. Without it, `#pragma parallel` is only useful for data-dependent address computation (`data[i]`), not for PE-level parallelism.

| Variant | Behavior |
|---------|----------|
| `#pragma parallel` | Serial: 1 column per cycle |
| `#pragma parallel collapse` | Parallel: all PEs in same cycle ✅ |

---

## Summary

| # | Issue | Severity | Workaround |
|---|-------|----------|------------|
| 1 | `all:` label-prefixed in functions | High | Use 4× `row N:` with pipes |
| 2 | `R3 = ZERO` not desugared | Medium | Use `SADD R3, ZERO, ZERO` |
| 3 | C-like fails in multi-`@` blocks | High | Use assembly syntax |
| 4 | C-like fails in `row N:` pipes | Medium | Use assembly syntax |
| 5 | `row N:` single-instr doesn't broadcast | High | Always use full pipe syntax |
| 6 | `for` inside `cycle { }` not supported | Medium | Write rows explicitly |
| 7 | `auto_cycle` doesn't work in functions | High | Use at kernel level only |
| 8 | `parallel` (no collapse) generates serial | Medium | Use `parallel collapse` |

---

## Issue 9: `col N:` broadcast syntax not implemented

**Symptom:**
```
Unexpected token inside cycle: col
```
when writing `cycle { col 2: SADD R0, ZERO, IMM(55); }`

**Root cause:** The cycle parser recognizes `row N:` and `all:` but not `col N:` as valid broadcast prefixes. The documentation lists `col N:` as supported syntax but it's not implemented.

**Workaround:** Use 4× `@row,N:` explicitly or `#pragma parallel collapse` with fixed column.

---

## Issue 10: `for` loop variable name `col` triggers parse error

**Symptom:**
```
Expected identifier for loop variable, got 'col'
```
when writing `for col in range(1, 4) { ... }`

**Root cause:** `col` is treated as a reserved keyword (from the `col N:` broadcast syntax) rather than as a valid loop variable identifier.

**Workaround:** Use a different variable name: `for c in range(...)` or `for j in range(...)`.

---

## Issue 11: `#pragma parallel collapse` generates isolated cycles that can't merge with other instructions

**Symptom:** When `#pragma parallel collapse` is adjacent to a `cycle { }` block with different `@row,col:` instructions, the pragma's cycle(s) remain separate — they can't be merged into the same cycle as other explicit instructions.

**Example:**
```c
// Wanted: 1 cycle with 7 PEs (4 diagonal + 3 off-diagonal)
#pragma parallel collapse
for d in range(4) {
    cycle { @d,d: SADD R3, ZERO, ZERO; }
}
cycle {
    @0,1: SADD R3, ZERO, ZERO;
    @1,2: SADD R3, ZERO, ZERO;
    @2,3: SADD R3, ZERO, ZERO;
}
// Actual: 2 separate cycles (diagonal in one, off-diagonal in another)
```

**Impact:** `#pragma parallel collapse` is only useful for **fully uniform** patterns where all PEs in the cycle do the same thing. When a cycle mixes pragma-generated and manually-placed instructions, the pragma can't be used without adding extra cycles.

**Workaround:** Use explicit `@row,col:` for all PEs when the cycle contains mixed instructions.

---

## Summary

| # | Issue | Severity | Workaround |
|---|-------|----------|------------|
| 1 | `all:` label-prefixed in functions | High | Use 4× `row N:` with pipes |
| 2 | `R3 = ZERO` not desugared | Medium | Use `SADD R3, ZERO, ZERO` |
| 3 | C-like fails in multi-`@` blocks | High | Use assembly syntax |
| 4 | C-like fails in `row N:` pipes | Medium | Use assembly syntax |
| 5 | `row N:` single-instr doesn't broadcast | High | Always use full pipe syntax |
| 6 | `for` inside `cycle { }` not supported | Medium | Write rows explicitly |
| 7 | `auto_cycle` doesn't work in functions | High | Use at kernel level only |
| 8 | `parallel` (no collapse) generates serial | Medium | Use `parallel collapse` |
| 9 | `col N:` broadcast not implemented | Medium | Use explicit `@row,N:` |
| 10 | `col` reserved as loop variable name | Low | Use `c` or `j` instead |
| 11 | `parallel collapse` cycles can't merge | Medium | Use explicit `@` for mixed cycles |
| 12 | C-like `&` operator parse error | Low | Use `LAND` assembly instruction |

---

## Issue 12: C-like `&` bitwise AND operator triggers parse error

**Symptom:**
```
Unexpected character '&'
```
when writing `@0,0: R1 = R0 & 255;`

**Root cause:** The C-like expression desugarer doesn't handle the `&` character. The documentation lists it as supported (`R1 = R0 & 0xFF` → `LAND R1, R0, 0xFF`) but the lexer rejects it.

**Workaround:** Use assembly syntax: `LAND R1, R0, 255`.

---
---

# Feature Proposal: Per-PE Operations Within Same Cycle

## The Problem

When defining cycles where each PE does something different, the only options are:

1. **Pipe syntax**: `row N: OP1 | OP2 | OP3 | OP4;` — verbose, 4× duplication per row
2. **Explicit `@row,col:`**: Fine for sparse PEs, but no loop compaction

`#pragma parallel collapse` generates perfectly merged cycles, but only for **uniform** patterns (all PEs run the same instruction). When one PE needs a different operation, the collapse can't be used (Issue #11). And `for` inside `cycle { }` is not supported (Issue #6).

## Three Approaches Evaluated

### Option A: New `grid { }` construct ❌ Not Recommended

```c
// Hypothetical syntax
grid {
    for d in range(4): @d,d: SADD R3, ZERO, ZERO;
    @0,1: SADD R3, ZERO, ZERO;
    @1,2: SADD R3, ZERO, ZERO;
}
```

**Problems:**
- Adds a **third** block type alongside `cycle { }` and `#pragma parallel collapse`
- Ambiguous: is `grid { }` always 1 cycle? What about data dependencies?
- Overlaps heavily with `cycle { }` + `for-in-cycle` (Option B)
- **Verdict:** Adds complexity without sufficient differentiation. The DSL already has `cycle { }` as the single-cycle abstraction — adding another is confusing.

### Option B: Fix Issue #6 (`for` inside `cycle { }`) ✅ Recommended

```c
cycle {
    for d in range(4) {
        @d,d: SADD R3, ZERO, ZERO;  // 4 diagonal PEs
    }
    @0,1: SADD R3, ZERO, ZERO;      // plus 3 off-diagonal
    @1,2: SADD R3, ZERO, ZERO;
    @2,3: SADD R3, ZERO, ZERO;
}
```

**Benefits:**
- **Zero new syntax** — `for` and `cycle { }` already exist
- Intuitive: "these instructions all go in the same cycle"
- Composable: can mix loops with explicit `@` statements
- Mirrors how OpenMP `parallel for` works inside a parallel region

**Implementation:** The cycle parser just needs to recognize `for` as a valid token inside `cycle { }` and unroll it at compile time, appending instructions to the current cycle's PE map.

**Edge case:** What if two iterations target the same PE?
```c
cycle {
    for d in range(4) {
        @d,d: SADD R3, ZERO, ZERO;
    }
    @0,0: SADD R3, ZERO, IMM(99);  // Conflict with d=0!
}
```
→ Compile error: "PE (0,0) assigned twice in same cycle". Same rule as existing `cycle { }` blocks.

### Option C: Computed immediates already solve most patterns ✅ Already Works

The most impactful discovery: **loop arithmetic in immediates** (`k%4*8`, `k/4*8`) already eliminates most "per-PE different operation" cases. These patterns work today:

```c
// extract_bytes_col: per-column different shift (0, 8, 16, 24)
#pragma parallel collapse
for k in range(16) {
    cycle { @k/4,k%4: SRT R1, R0, k%4*8; }   // shift = 0, 8, 16, 24 per col
    cycle { @k/4,k%4: LAND R1, R1, 255; }     // mask all to 8 bits
}

// extract_bytes_row: per-row different shift (0, 8, 16, 24)
#pragma parallel collapse
for k in range(16) {
    cycle { @k/4,k%4: SRT R0, R0, k/4*8; }   // shift = 0, 8, 16, 24 per row
    cycle { @k/4,k%4: LAND R0, R0, 255; }     // mask all to 8 bits
}

// mu preload: per-row different data address
#pragma parallel collapse
for k in range(12) {
    cycle { @k/4,k%4: LWI R1, mu[k/4]; }     // row 0→mu[0], row 1→mu[1], row 2→mu[2]
}
```

**Verified:** All three patterns compile correctly and produce identical CSV output (tested).

## Critical Analysis

| Pattern Type | Current v7 | With Option B | With Option C |
|-------------|------------|---------------|---------------|
| Uniform 16-PE (load_all, SMUL) | `collapse` ✅ | Same | Same |
| Per-col shift (extract_bytes_col) | 8 lines of pipes | 3 lines | **5 lines** ✅ already works |
| Per-row shift (extract_bytes_row) | 6 lines of pipes | 3 lines | **5 lines** ✅ already works |
| Per-row data (mu/p_limbs) | 3-4 lines of pipes | 2 lines | **4 lines** ✅ already works |
| Diagonal init (7 PEs) | 4 lines explicit | **1 for + 3 lines** | N/A (not uniform) |
| ROUT accumulate chains | 40+ lines explicit | Same (irreducible) | Same (irreducible) |

### What truly CAN'T be simplified

The following patterns are **inherently irregular** — each PE runs a different opcode with different operands:

- `accumulate_c_square/multiply_inregs_and_route`: each PE's source/dest registers differ (R2 vs ROUT vs RCL vs RCB)
- `route_c_to_row0`: hand-optimized ROUT relay topology
- `build_limbs carry chain`: sequentially dependent across columns

These represent ~60% of the kernel's code. No language feature can compress them because the irregularity is fundamental to the algorithm, not an artifact of the DSL.

## Recommendation

1. **Immediate win (no compiler changes):** Apply Option C — replace `extract_bytes` pipe syntax with computed immediate collapse patterns. This is already testable.

2. **Compiler enhancement:** Fix **Issue #6** (`for` inside `cycle { }`) — this is the single highest-impact improvement. It enables mixing loop-generated and hand-placed instructions in the same cycle without requiring a new language construct.

3. **Do NOT add a new `grid { }` or `pe_map { }` construct** — the benefit is marginal and adds cognitive overhead. The `cycle { }` block is the right abstraction; it just needs `for` support.
