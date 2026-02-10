@# OpenEdgeDSL Compiler Issues — Discovered During SBOX K7 v6 Porting

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

---
---

# Latency Analysis: CSV Utilization and Optimization Opportunities

## Kernel Metrics (v7, 290 cycles)

| Metric | Value | Notes |
|--------|-------|-------|
| Total cycles | 290 | 4 modular ops (2 square + 2 multiply) |
| Mean PE utilization | ~25% | 4 of 16 PEs active per cycle |
| Cycles with ≤4 active PEs | 218/290 (75%) | Most cycles are heavily underutilized |
| Cycles using only Row 0 | 206/290 (71%) | Rows 1-3 idle for most of the kernel |
| Wasted PE-slots | 2960 of 4640 (64%) | Potential for parallel exploitation |

The kernel consists of 4 modular operations (~70 cycles each). Each operation has:
- **Parallel phase** (~10 cycles): extract_bytes, SMUL, accumulate — good utilization (8-16 PEs)
- **Serial phase** (~60 cycles): carry chain, borrow chain, normalization — 1-2 PEs only

---

## Bottleneck 1: Carry Chain — `build_limbs_base16_from_regs`

**What it does:** Converts 7 coefficients (base 2⁸) into 5 limbs (base 2¹⁶) with carry propagation between adjacent columns.

**Cycle pattern (repeats for 4 limbs, 8 cycles each = 32 total):**
```
@0,j:   LAND R0, R0, 65535     // mask to 16 bits
@0,j+1: SADD R0, R0, RCL      // add carry from left neighbor
@0,j:   SWI R0, L[j]           // store completed limb
@0,j+1: SRT R3, R0, 16        // extract new carry
```

**Problem:** Each limb's carry depends on the previous limb's result → sequential chain across PE(0,0) → PE(0,1) → PE(0,2) → PE(0,3). Only 1-2 PEs active per cycle.

**Impact:** 8 cycles × 4 iterations = **32 cycles (11% of total)**.

**Why it can't be parallelized:** Data dependency — each column needs the carry output of the previous column. This is fundamentally serial in the current limb representation.

---

## Bottleneck 2: Borrow Chain — `compute_r_inregs`

**What it does:** Computes R = L − RH with borrow propagation, then performs conditional subtraction (Barrett correction).

**Cycle pattern (10-14 serial cycles per iteration):**
```
@0,j: SSUB R2, R0, R3          // subtract
@0,j: SRT R0, R2, 31           // extract sign bit (borrow)
@0,j: SLT R1, R0, 16           // scale borrow to 2^16
@0,j+1: SSUB R2, R2, RCL       // propagate borrow to next PE
// ... reconstruction + BSFA conditional select
```

**Problem:** Identical to Bottleneck 1 — borrow propagation creates a sequential dependency chain across PE(0,0) → PE(0,1) → PE(0,2).

**Impact:** 14 cycles × 4 iterations = **56 cycles (19% of total)**. This is the **largest single bottleneck**.

---

## Bottleneck 3: `#pragma route` Relay — `compute_qhat_inregs`

**What it does:** Moves a partial product from PE(0,1) to PE(0,3) via a 2-hop toroidal route.

**Cycle pattern (3 cycles per iteration):**
```
@0,1: SADD ROUT, R1, ZERO      // source sends
@0,2: SADD ROUT, RCL, ZERO     // intermediate relays
@0,3: SADD R0, RCL, ZERO       // destination receives
```

**Problem:** The route pragma generates one cycle per hop (Manhattan distance + 1). A 2-hop route costs 3 cycles regardless of what the other 14 PEs are doing.

**Impact:** 3 cycles × 4 iterations = **12 cycles (4% of total)**.

---

## Optimization Proposals

### OPT-A: Cycle Packing — Post-Compilation Instruction Scheduling

**Problem it solves:** Many consecutive 1-2 PE cycles are independent and could be merged into fewer cycles.

**Example from actual CSV:**
```c
// Current: 3 separate cycles (cycles 42-44)
cycle { @0,0: SADD ROUT, R1, ZERO; }  // 1 PE
cycle { @0,2: SADD ROUT, R1, ZERO; }  // 1 PE (independent from above!)
cycle { @0,3: SADD ROUT, R1, ZERO; }  // 1 PE (also independent!)

// Optimized: 1 cycle
cycle {
    @0,0: SADD ROUT, R1, ZERO;
    @0,2: SADD ROUT, R1, ZERO;
    @0,3: SADD ROUT, R1, ZERO;
}
```

**How it works:** A post-compilation pass that:
1. Builds a dependency graph (def-use chains + neighbor read hazards)
2. Identifies cycles targeting distinct PEs with no data dependency between them
3. Merges compatible cycles into a single cycle
4. Validates no PE is assigned twice and no neighbor read conflicts exist

**Implementation in DSL compiler:**
- New pass after CSV generation: `CyclePackingPass`
- Input: list of cycles with per-PE instruction assignments
- Output: compacted list with merged cycles
- Constraint: only merge if no instruction reads a neighbor (`RCL`, `RCR`, `RCT`, `RCB`) that would be affected by the merge

**Estimated impact:** -8 to -12 cycles (3-4% reduction). The gains are modest because most serial sections have genuine data dependencies. The independent cycles are scattered in the normalization and route setup phases.

**Complexity:** Medium — requires building a dependency graph and solving a scheduling problem. Similar to what Compigra's ILP scheduler does, but simpler because the PE assignments are already fixed.

---

### OPT-B: Parallel Route Generation — Multi-Source `#pragma route`

**Problem it solves:** When multiple `#pragma route` directives share intermediate hops, the compiler generates them sequentially. If routes don't share PEs or can overlap in time, they could execute in parallel.

**Example:**
```c
// Current: 3 separate #pragma route calls → 9 cycles
#pragma route (1,1) -> (0,1) payload(R3) accum(R3)  // 2 hops, 3 cycles
#pragma route (2,2) -> (0,2) payload(R3) accum(R3)  // 3 hops, 4 cycles  
#pragma route (3,3) -> (0,3) payload(R3) accum(R3)  // 4 hops, 5 cycles

// Optimized: routes overlap in time since they use different PE paths
// Total: max(3, 4, 5) = 5 cycles instead of 3+4+5 = 12 cycles
```

**How it works:** The compiler collects all route directives in a region and generates a **time-space schedule** where:
1. Routes that use disjoint PEs at each timestep execute simultaneously
2. Routes that share PEs at any timestep are serialized only for those specific timesteps
3. The total cycle count equals the **critical path** (longest single route) rather than the sum

**Implementation in DSL compiler:**
- New directive: `#pragma route_group { ... }` or automatic detection of consecutive route pragmas
- Route scheduler: for each timestep, place as many non-conflicting hop instructions as possible
- Output: merged cycles with multiple PEs active per cycle

**Estimated impact:** -4 to -8 cycles (1-3% reduction). In SBOX K7, the route section uses hand-optimized parallel ROUT chains (4 cycles) which already outperforms serial `#pragma route` (which would be ~20 cycles). This proposal would let the compiler match the hand-optimized version automatically.

**Complexity:** Medium-High — requires a spatial-temporal scheduling algorithm. The benefit is more in ergonomics (declarative routes instead of hand-optimized ROUT chains) than in raw latency reduction.

**Note:** In v7, `route_c_to_row0()` is already hand-optimized to 4 cycles. This proposal would make the hand-optimization unnecessary.

---

### OPT-C: Redundant Limb Representation — Carry-Free Arithmetic

**Problem it solves:** The carry chain (`build_limbs`) is the second largest bottleneck at 32 cycles (11%). The chain exists because limbs must be normalized to exactly 16 bits before Barrett reduction.

**How it works:** Instead of normalizing limbs to `[0, 2^16)` after every multiplication, allow **redundant representation** where limbs can temporarily exceed the base:
- After coefficient accumulation: limbs are in range `[0, ~2^24)` (sum of 8-bit × 8-bit products)
- Skip carry propagation — directly feed into Barrett q̂ computation
- Adjust Barrett μ constants to handle wider limbs
- Perform carry propagation only once, at the final result reconstruction

**Trade-offs:**
- **Pro:** Eliminates 32 serial cycles per kernel (11% reduction)
- **Pro:** Dramatically simplifies `build_limbs` function
- **Con:** Requires wider intermediate registers (CGRA registers are 32-bit — may overflow for accumulated sums)
- **Con:** Barrett μ must be recomputed for the new limb range
- **Con:** Requires mathematical verification that the wider representation doesn't cause modular reduction errors

**Feasibility check:** Each coefficient c_k is the sum of at most 4 products of 8-bit × 8-bit values. Maximum c_k ≤ 4 × 255² = 260,100. A 16-bit limb pair (c_{2i+1} << 8 + c_{2i}) reaches at most ~66 million, well within 32-bit range. The carry propagation could be deferred.

**Estimated impact:** -32 cycles (11% reduction), from 290 → ~258 cycles.

**Complexity:** High — requires reworking the mathematical proof of Barrett reduction correctness, modifying μ computation, and extensive verification.

---

### OPT-D: Fix Issue #6 — `for` Inside `cycle { }` (Code Clarity)

**Problem it solves:** Not a latency reduction, but a **code clarity** and **expressiveness** improvement. Currently, mixing loop-generated and hand-placed instructions in one cycle requires explicit enumeration of all PEs.

**See:** Feature Proposal section above for full details.

**Estimated impact:** 0 cycles (no latency change), but significant reduction in code verbosity for mixed-PE patterns.

---

## Impact Summary

| Proposal | Latency Reduction | Implementation Effort | Scope |
|----------|------------------|-----------------------|-------|
| **OPT-A** Cycle Packing | -8 to -12 cycles (3-4%) | Medium | DSL compiler pass |
| **OPT-B** Parallel Routes | -4 to -8 cycles (1-3%) | Medium-High | DSL compiler + route scheduler |
| **OPT-C** Carry-Free Limbs | **-32 cycles (11%)** | High | Algorithm + math verification |
| **OPT-D** for-in-cycle | 0 cycles | Low | DSL parser fix |
| **Combined A+C** | **-40 to -44 cycles (14-15%)** | High | Full rework |

**Recommendation priority:** OPT-D (low effort, high ergonomic value) → OPT-A (moderate effort, measurable gain) → OPT-C (high effort but highest impact on latency).

---
---

# Implemented Optimizations (v7 → v7-optimized)

## True Hardware Cycle Model

The "instruction cycles" reported by the DSL compiler count CSV rows, **NOT** real hardware clock cycles. The CGRA has multi-cycle instructions:

| Instruction Type | Latency | Stall Overhead |
|-----------------|:-------:|:--------------:|
| ALU (SADD, SSUB, SLT, SRT, LAND, BSFA...) | 1cc | 0 |
| Memory (LWI, SWI) | 2cc | +1 per cycle |
| Multiplication (SMUL) | 3cc | +2 per cycle |

A cycle containing **any** multi-cycle instruction costs the **maximum latency** of all instructions in that cycle (the entire grid stalls).

### v7-optimized Hardware Cost

| Category | Instruction Cycles | × Latency | HW Cycles | Stalls |
|----------|:-:|:-:|:-:|:-:|
| ALU-only | 212 | 1cc | 212 | 0 |
| Memory (LWI/SWI) | 50 | 2cc | 100 | 50 |
| SMUL | 12 | 3cc | 36 | 24 |
| **Total** | **274** | — | **349** | **75** |

---

## OPT-E: 2-Limb Barrett Remainder (IMPLEMENTED)

**Commit:** `9dc6fd4` — `perf(dsl_port): optimize compute_r to 2-limb Barrett remainder`

### Problem

`compute_r_inregs` processed 3 limbs (L[0..2]) with a 3-stage borrow chain P0→P1→P2, using 7 borrow cycles + 7 reconstruction cycles = 16 cycles per call.

### Mathematical Proof

Barrett reduction guarantees `0 ≤ r < 2p`. Since `2p = 4,026,531,842 < 2^32`:

```
max remainder = 2p - 1 = 4,026,531,841
L[0] = r & 0xFFFF       (16 bits)
L[1] = (r >> 16) & 0xFFFF (16 bits)
L[2] = (r >> 32) & 0xFFFF = 0  (always!)
```

**Verified:** 100,000 random inputs, L[2] = 0 for all.

### Changes

- Eliminated L[2] load, P2 borrow chain (5 cycles), and 3-limb reconstruction
- `compute_r_inregs`: 16 → 12 cycles per call
- **Impact:** **-16 instruction cycles** (4 calls × 4 cycles), **290 → 274**

---

## OPT-F: SMUL-by-1 Elimination (IMPLEMENTED)

**Commit:** `f9d4437` — `perf(dsl_port): eliminate SMUL-by-1 in mul_qhat_p`

### Problem

`mul_qhat_p_inregs` loaded `p_limbs[0] = 1` via LWI and then computed `SMUL R2, R0, 1` on row 0. Multiplying by 1 is identity — wasted 3cc SMUL latency per instruction.

### Changes

- Row 0: `SMUL R2, R0, R1` (3cc) → `SADD R2, R0, ZERO` (1cc)
- Eliminated 4 LWI instructions (p_limbs[0] load)
- Merged row 0 SADD with row 1 LWI p_limbs[1] in same cycle

**Impact:** Same 274 instruction cycles, but **-8cc hardware** (4 SMUL@3cc → 4 SADD@1cc)

---

## OPT-G: SMUL Stall Hiding — p Preload (IMPLEMENTED)

**Commit:** `a297817` — `perf(dsl_port): hide p LWI in SMUL stall cycle`

### Problem

`compute_r_inregs` loaded `p` (at address 4) via `LWI R1, 4` at PE(0,3) for the BSFA conditional subtraction. This 2cc LWI happened in a standalone cycle.

### Technique: SMUL Stall Hiding

During `mul_qhat_p`'s SMUL cycle, only row 1 PEs are active (4 SMUL). Row 0 is entirely idle, paying 3cc for nothing. By adding `@0,3: LWI R0, 4` to this cycle:

```
// Before: row 0 idle during 3cc SMUL
cycle { row 1: SMUL R2,R0,R1 | SMUL R2,R0,R1 | SMUL R2,R0,R1 | SMUL R2,R0,R1; }

// After: LWI hidden inside SMUL stall (0 extra cost)
cycle { @0,3: LWI R0, 4; row 1: SMUL R2,R0,R1 | ...; }
```

The LWI (2cc) fits entirely within the SMUL stall (3cc). PE(0,3):R0 is verified to survive through collect, accumulate, normalize, send, and add phases — never overwritten until `compute_r` reads it via `SADD R1, R0, ZERO`.

**Impact:** -4 LWI cycles (hidden), **-4cc hardware**

---

## LWI Feasibility Study: Why Remaining LWIs Can't Be Eliminated

### LWI Inventory (274 instruction cycles)

| Category | LWIs | Cycles | Can Route? | Reason |
|----------|:----:|:------:|:----------:|--------|
| `load_all` broadcast | 16×4=64 | 4 | **NO** | LWI@2cc < routing@4cc for fan-out |
| mu preload (3 rows) | 11×4=44 | 4 | **NO** | SMUL overwrites all regs between iters |
| mu[0] reload PE(0,0) | 1×4=4 | 4 | **NO** | ROUT[1]=L[1] (not mu[0]) at needed cycle |
| L[1..4] for compute_qhat | 12×4=48 | 4 | **NO** | R0-R3 all used, zero free registers |
| L[0..1] for compute_r | 2×4=8 | 4 | **NO** | R0 overwritten by compute_qhat's 1st instr |
| p_limbs[1] for mul_qhat_p | 4×4=16 | 4 | **NO** | Constant but no reg survives SMUL+accum |
| ~~p for BSFA~~ | ~~1×4=4~~ | ~~4~~ | **YES ✓** | Hidden in SMUL stall (OPT-G) |
| ~~p_limbs[0]=1~~ | ~~4×4=16~~ | ~~4~~ | **YES ✓** | Identity: SADD copy (OPT-F) |

### Key Architectural Constraint

On OpenEdgeCGRA, **memory broadcast (LWI with same address to N PEs) is cheaper than register routing** for fan-out patterns. The column bus delivers data to all rows in 2cc, while N-to-1 ROUT chains take ≥N cycles. This means LWI elimination only helps for:
1. Constants that can stay in registers (if a free register survives across functions)
2. LWIs that can be hidden inside multi-cycle instruction stalls (SMUL/LWI overlap)

---

## Combined Optimization Results

| Version | Instr Cycles | HW Cycles | Δ Instr | Δ HW |
|---------|:---:|:---:|:---:|:---:|
| v7 baseline | 290 | ~377 | — | — |
| + OPT-E (2-limb) | **274** | 353 | **-16** | **-24** |
| + OPT-F (SMUL-by-1) | 274 | 349 | 0 | **-4** |
| + OPT-G (p stash) | 274 | **349** | 0 | **-4** (hidden) |
| **Total** | **274** | **349** | **-16 (-5.5%)** | **-28 (-7.4%)** |

All optimizations verified: **12/12 tests pass** across full BabyBear range.

---
---

# DSL Feature Gap Analysis — Missing Language Features

Analysis of the v7-optimized kernel (332 lines, 274 instr, 349 hwcc) to identify language features that would reduce code size, cycle count, or hardware latency.

---

## 🔴 HIGH IMPACT — Latency Reduction

### FEAT-1: `#pragma latency_hide` — Latency-Aware Instruction Scheduling

**Problem:** 75 stall cycles (27% overhead) from LWI (2cc) and SMUL (3cc). SMUL cycles have idle PEs that waste the 2-cycle stall. We manually hid the `p` LWI inside a SMUL slot (OPT-G), but the compiler should do this automatically.

**Current (manual):**
```c
// Manually merge LWI into SMUL slot
cycle {
    @0,3: LWI R0, 4;  // hidden in SMUL stall
    row 1: SMUL R2, R0, R1 | SMUL R2, R0, R1 | SMUL R2, R0, R1 | SMUL R2, R0, R1;
}
```

**Proposed:**
```c
#pragma latency_hide  // compiler auto-merges adjacent cycles
cycle { row 1: SMUL R2, R0, R1 | ...; }  // 3cc, row 0 idle
cycle { @0,3: LWI R1, 4; }               // compiler moves this INTO the SMUL cycle
```

**Impact:** -10 to -20 hwcc. The compiler analyzes data dependencies and PE occupancy to fill stall slots with independent work from adjacent cycles.

---

### FEAT-2: `#pragma carry_chain` — Carry Propagation Primitive

**Problem:** The `build_limbs` carry chain (lines 131-139) is 8 hand-written cycles with a repeating `LAND → SADD RCL → SWI → SRT` pattern. Data-dependent but structurally regular.

**Current (8 cycles, 8 lines):**
```c
cycle { @0,0: LAND R0, R0, 65535; @0,1: SADD R0, R0, RCL; }
cycle { @0,0: SWI R0, L[0]; @0,1: SRT R3, R0, 16; }
cycle { @0,1: LAND R0, R0, 65535; @0,2: SADD R0, R0, RCL; }
cycle { @0,1: SWI R0, L[1]; @0,2: SRT R3, R0, 16; }
// ... repeats for L[2], L[3], L[4]
```

**Proposed:**
```c
#pragma carry_chain(src=R0, carry=R3, mask=65535, width=16, limbs=4, store=L)
```

The compiler generates the optimal interleaved schedule, potentially finding internal parallelism (e.g., overlapping SWI with the next iteration's LAND).

**Impact:** -30 lines. Potential -4 cycles if compiler finds better scheduling than hand-written.

---

### FEAT-3: `#pragma specialize` — Constant Specialization

**Problem:** We manually discovered that `p_limbs[0] = 1` and replaced `SMUL R2, R0, 1` (3cc) with `SADD R2, R0, ZERO` (1cc). The compiler should detect and optimize multiply-by-1, multiply-by-0, add-with-0, and similar identity operations automatically.

**Current (manual):**
```c
// We had to manually recognize p_limbs[0]=1 and rewrite
cycle {
    row 0: SADD R2, R0, ZERO | SADD R2, R0, ZERO | ...; // identity copy
    row 1: LWI R1, p_limbs[1] | ...;                      // real multiply
}
```

**Proposed:**
```c
#pragma specialize(p_limbs[0] == 1)  // or auto-detected from .data
// Compiler replaces SMUL R2, R0, R1 with SADD R2, R0, ZERO where R1=1
```

**Impact:** -8 hwcc automatically (4×SMUL@3cc → 4×SADD@1cc). Zero manual effort.

---

## 🟡 MEDIUM IMPACT — Code Reduction + Clarity

### FEAT-4: `for` Inside `cycle { }` — Mixed Loop + Explicit PEs (Issue #6)

**Problem:** Diagonal patterns (4 PEs), triangle inits (7 PEs), and sparse patterns require listing every PE coordinate. A `for` inside a cycle block would allow compact expressions.

**Current (4 lines for diagonal init):**
```c
cycle {
    @0,0: SADD R3, ZERO, ZERO; @1,1: SADD R3, ZERO, ZERO;
    @2,2: SADD R3, ZERO, ZERO; @3,3: SADD R3, ZERO, ZERO;
}
```

**Proposed (1 line):**
```c
cycle { for k in range(4) { @k,k: SADD R3, ZERO, ZERO; } }
```

**Impact:** -15 lines across diagonal inits (+7 lines), triangle ops (+8 lines).

---

### FEAT-5: `#pragma normalize` — Base-2^16 Normalization

**Problem:** The `SRT R1, R3, 16; LAND R3, R3, 65535` + carry propagation pattern appears **3 times** in the kernel (build_limbs, compute_qhat, mul_qhat_p). It's the canonical normalize-and-carry for multi-limb arithmetic.

**Current (6 lines per instance, ~18 total):**
```c
#pragma parallel collapse
for j in range(4) {
    cycle { @0,j: SRT R1, R3, 16; }
    cycle { @0,j: LAND R3, R3, 65535; }
}
cycle { row 0: SADD ROUT, R1, ZERO | SADD ROUT, R1, ZERO | SADD ROUT, R1, ZERO | _; }
cycle { row 0: _ | SADD R3, R3, RCL | SADD R3, R3, RCL | SADD R3, R3, RCL; }
```

**Proposed (1 line):**
```c
#pragma normalize(reg=R3, width=16, cols=4, carry_dir=right)
```

**Impact:** -20 lines. Abstracts the most common pattern in multi-limb CGRA arithmetic.

---

### FEAT-6: `#pragma triangle` — Upper/Lower Triangle Patterns

**Problem:** The Karatsuba upper-triangle SMUL (lines 90-95) maps 10 PEs where `col >= row`. Cannot be expressed with a single `for` because the condition is 2D.

**Current (5 lines):**
```c
row 0: SMUL R2, R0, R1 | SMUL R2, R0, R1 | SMUL R2, R0, R1 | SMUL R2, R0, R1;
row 1: _ | SMUL R2, R0, R1 | SMUL R2, R0, R1 | SMUL R2, R0, R1;
@2,2: SMUL R2, R0, R1; @2,3: SMUL R2, R0, R1;
@3,3: SMUL R2, R0, R1;
```

**Proposed (1 line):**
```c
#pragma triangle(upper, inclusive) { @row,col: SMUL R2, R0, R1; }
```

**Impact:** -10 lines. Semantic clarity — immediately conveys "upper triangle multiply."

---

### FEAT-7: `#pragma broadcast` Implementation

**Problem:** `#pragma broadcast` exists in the language spec but is **not implemented**. The kernel uses `load_all()` (16 LWI from same address) as a workaround. When the source is a register (not memory), there's no broadcast primitive — manual ROUT chains are needed.

**Current (3 lines function):**
```c
function load_all(reg, addr) {
    #pragma parallel collapse
    for k in range(16) { cycle { @k/4,k%4: LWI reg, addr; } }
}
```

**Proposed:**
```c
#pragma broadcast(value=R3, from=@0,0, to=all)
// Compiler chooses: SWI+LWI (if cheaper) or ROUT tree (if source is register)
```

**Impact:** -5 lines. Compiler makes the LWI vs routing cost decision automatically.

---

## 🟢 LOW IMPACT — Ergonomics

### FEAT-8: Range Coordinate Syntax — `@0,0..3` (Issue #7)

**Problem:** Every multi-PE instruction requires explicit coordinate listing.

**Current:** `@0,0: SADD R3, ZERO, ZERO; @0,1: SADD R3, ZERO, ZERO; @0,2: SADD R3, ZERO, ZERO; @0,3: SADD R3, ZERO, ZERO;`

**Proposed:** `@0,0..3: SADD R3, ZERO, ZERO;`

**Impact:** -10 lines across kernel.

---

### FEAT-9: Inline Operand Arithmetic

**Problem:** Memory operands don't support arithmetic. Must use `.data` named arrays or `.const` workarounds.

**Current:** `.data L 360 { 0, 0, 0, 0, 0 }` then `LWI R0, L[j]`
**Could be:** `LWI R0, 360 + j*4` (if inline arithmetic were supported)

**Impact:** -5 lines (eliminate buffer declarations).

---

### FEAT-10: `#pragma stash` — Register Lifetime Extension

**Problem:** Values like `L[0..1]` and `mu[0]` are needed across function boundaries but get overwritten by intermediate operations. Manual stashing to row 3 (which is idle) takes 6-8 routing cycles, more expensive than LWI. The compiler could optimize this by analyzing register lifetimes across functions.

**Proposed:**
```c
#pragma stash(R0@(0,0), into=@(3,0), lifetime=until(compute_r))
// Compiler generates optimal route+retrieval or decides memory is cheaper
```

**Impact:** 0 to -8 hwcc (compiler decides the cheapest approach: register route vs memory spill).

---

## Summary

| Feature | Lines | Cycles | HW Latency | Effort |
|---------|:---:|:---:|:---:|:---:|
| FEAT-1 `latency_hide` | 0 | 0 | **-10 to -20cc** | High |
| FEAT-2 `carry_chain` | **-30** | -0 to -4 | -0 to -8cc | High |
| FEAT-3 `specialize` | -3 | 0 | **-8cc** (auto) | Medium |
| FEAT-4 `for`-in-cycle | **-15** | 0 | 0 | Low |
| FEAT-5 `normalize` | **-20** | 0 | 0 | Medium |
| FEAT-6 `triangle` | **-10** | 0 | 0 | Medium |
| FEAT-7 `broadcast` (impl) | -5 | -0 to -4 | -0 to -8cc | Medium |
| FEAT-8 Range coords | **-10** | 0 | 0 | Low |
| FEAT-9 Inline arithmetic | -5 | 0 | 0 | Low |
| FEAT-10 `stash` | -5 | -0 to -4 | -0 to -8cc | High |
| **Total potential** | **~-100 lines** | **-4 to -12** | **-18 to -44cc** | — |

### Recommended Priority

1. **FEAT-4** (for-in-cycle) — Low effort, high ergonomic value, already Issue #6
2. **FEAT-8** (range coords) — Low effort, immediate readability improvement
3. **FEAT-3** (specialize) — Medium effort, automatic latency reduction
4. **FEAT-1** (latency_hide) — High effort, highest latency impact
5. **FEAT-5** (normalize) — Medium effort, most frequent pattern in ZKP kernels

---

## Domain-Specific Patterns (FEAT-11..17)

These are higher-level abstractions targeting **multi-limb arithmetic** and **CGRA spatial patterns** that appear repeatedly in ZKP kernels.

---

### FEAT-11: Parameterized Byte Extraction — `extract_bytes(axis)`

**Problem:** `extract_bytes_col` and `extract_bytes_row` are identical except for the shift formula (`k%4*8` vs `k/4*8`). Two 7-line functions for what should be one.

**Current (14 lines):**
```c
function extract_bytes_col(src, dst) {
    #pragma parallel collapse
    for k in range(16) {
        cycle { @k/4,k%4: SRT dst, src, k%4*8; }
        cycle { @k/4,k%4: LAND dst, dst, 255; }
    }
}
function extract_bytes_row(src, dst) {
    #pragma parallel collapse
    for k in range(16) {
        cycle { @k/4,k%4: SRT dst, src, k/4*8; }
        cycle { @k/4,k%4: LAND dst, dst, 255; }
    }
}
```

**Proposed (7 lines):**
```c
function extract_bytes(src, dst, axis) {
    #pragma parallel collapse
    for k in range(16) {
        cycle { @k/4,k%4: SRT dst, src, k.select(axis, col=%4, row=/4)*8; }
        cycle { @k/4,k%4: LAND dst, dst, 255; }
    }
}
```

Requires the DSL to support **conditional expressions** on loop variables based on function parameters.

**Impact:** -7 lines.

---

### FEAT-12: `#pragma collect` — Cross-Row Value Collection

**Problem:** The pattern "read ROUT from another row and accumulate" appears 3 times in the kernel with the same structure: read RCB/RCT from adjacent row, then combine with local register.

**Current (5 lines per instance, ~15 total):**
```c
// Instance 1: collect row 1 products in mul_qhat_p (lines 204-209)
#pragma parallel collapse
for j in range(4) {
    cycle { @0,j: SADD R3, RCB, ZERO; }
}
cycle { row 0: SADD R3, R2, ZERO | SADD R3, R2, RCL | SADD R3, R2, RCL | SADD R3, R2, RCL; }

// Instance 2: collect row 1 products in compute_qhat (lines 154-161)
// Instance 3: collect diagonal via RCT in accumulate_c (lines 104-113)
```

**Proposed (1 line per instance):**
```c
#pragma collect(from=row(1), via=RCB, local=R2, into=R3, combine=shift_add)
```

**Impact:** -12 lines across 3 instances.

---

### FEAT-13: `#pragma accumulate` — Product Accumulation Networks

**Problem:** The product accumulation in `accumulate_c_multiply` (lines 274-304) is the **longest single block** in the kernel: 31 lines of hand-optimized ROUT chains where each PE has a different instruction (RCB, RCL, RCR, RCT, SELF, R2). This is a **convolution accumulation graph** that maps anti-diagonal sums.

**Current (31 lines):**
```c
// 7 cycles of route+accumulate + 2 cycles of ROUT refresh
// Each cycle: custom per-PE mix of ROUT forwarding and R3 accumulation
cycle {
    @0,0: SADD ROUT, RCB, ZERO; @0,1: SADD R3, R3, R2;
    row 1: SADD ROUT, RCB, ZERO | SADD ROUT, RCB, ZERO | ... ;
    // ... (31 lines total)
}
```

**Proposed:**
```c
#pragma accumulate(pattern=anti_diagonal, products=R2, accum=R3, out=ROUT)
// Compiler generates the optimal routing graph for anti-diagonal accumulation
```

**Impact:** -30 lines. This is the highest single-block reduction potential but also the hardest to implement — requires the compiler to synthesize optimal ROUT chains for arbitrary accumulation topologies.

---

### FEAT-14: `#pragma conditional_sub` — Barrett Conditional Subtraction

**Problem:** The Barrett final step (reconstruct → subtract p → BSFA select) is a 5-cycle idiom that appears identically 4 times in the kernel (once per modular operation):

**Current (5 lines per call, called 4×):**
```c
// Reconstruction + conditional subtraction
cycle { @0,0: SADD R0, R2, ZERO; @0,1: SLT R1, R2, 16; }
cycle { @0,0: SADD R0, R0, RCR; @0,3: SADD R1, R0, ZERO; }
cycle { @0,0: SSUB R2, R0, RCL; }
cycle { @0,0: BSFA R3, R0, R2, SELF; }
cycle { @0,0: SWI R3, out_addr; }
```

**Proposed (1 line):**
```c
#pragma conditional_sub(limb0=R2@(0,0), limb1=R2@(0,1), prime_addr=4, out=out_addr)
```

**Impact:** The idiom is already inside a function so current lines don't multiply, but it makes the semantic intent instantly clear. -3 lines.

---

### FEAT-15: Row Auto-Broadcast Syntax

**Problem:** When all 4 PEs in a row execute the same instruction, the current syntax requires repeating it 4 times with `|`:

**Current:**
```c
row 1: LWI R1, mu[1] | LWI R1, mu[1] | LWI R1, mu[1] | LWI R1, mu[1];
```

**Proposed:** When a row has a single instruction (no `|` separators), auto-expand to all columns:
```c
row 1: LWI R1, mu[1];  // → all 4 cols
```

This is distinct from FEAT-8 (range coords). FEAT-8 targets `@row,col..col` coordinate ranges; FEAT-15 targets the **visual pipe** row syntax.

**Impact:** -6 lines across mu preload (lines 127-129), p_limbs load (line 197), SMUL rows.

---

### FEAT-16: Pipeline Macro — Shared Tail Abstraction

**Problem:** `square_mod` and `multiply_mod` share 4 of 5 function calls (the "Barrett pipeline tail"):

**Current (12 lines):**
```c
function square_mod(in_addr, out_addr) {
    accumulate_c_square_inregs_and_route(in_addr);
    build_limbs_base16_from_regs();
    compute_qhat_inregs();
    mul_qhat_p_inregs();
    compute_r_inregs(out_addr);
}
function multiply_mod(a_addr, b_addr, out_addr) {
    accumulate_c_multiply_inregs_and_route(a_addr, b_addr);
    build_limbs_base16_from_regs();
    compute_qhat_inregs();
    mul_qhat_p_inregs();
    compute_r_inregs(out_addr);
}
```

**Proposed:**
```c
macro barrett_tail(out_addr) {
    build_limbs_base16_from_regs();
    compute_qhat_inregs();
    mul_qhat_p_inregs();
    compute_r_inregs(out_addr);
}
function square_mod(in, out) { accum_square(in); barrett_tail(out); }
function multiply_mod(a, b, out) { accum_mul(a, b); barrett_tail(out); }
```

**Impact:** -5 lines, clearer separation between accumulation strategy and reduction pipeline.

---

### FEAT-17: `#pragma guard(condition)` — Conditional PE Activation in Loops

**Problem:** The upper-triangle SMUL (lines 90-95) and diagonal init (lines 267-271) are patterns where only PEs matching a 2D condition are active. These can't be expressed with a simple `for` loop.

**Current (5 lines for triangle, 4 lines for diagonal):**
```c
// Upper triangle: col >= row
row 0: SMUL R2, R0, R1 | SMUL R2, R0, R1 | SMUL R2, R0, R1 | SMUL R2, R0, R1;
row 1: _ | SMUL R2, R0, R1 | SMUL R2, R0, R1 | SMUL R2, R0, R1;
@2,2: SMUL R2, R0, R1; @2,3: SMUL R2, R0, R1;
@3,3: SMUL R2, R0, R1;

// Diagonal: col == row
@0,0: SADD R3, ZERO, ZERO; @1,1: SADD R3, ZERO, ZERO;
@2,2: SADD R3, ZERO, ZERO; @3,3: SADD R3, ZERO, ZERO;
```

**Proposed:**
```c
// Upper triangle
#pragma parallel collapse
for k in range(16) {
    #pragma guard(k%4 >= k/4)
    cycle { @k/4,k%4: SMUL R2, R0, R1; }
}

// Diagonal
#pragma parallel collapse
for k in range(16) {
    #pragma guard(k%4 == k/4)
    cycle { @k/4,k%4: SADD R3, ZERO, ZERO; }
}
```

More general than FEAT-6 (`#pragma triangle`): allows any boolean condition over the PE index space. Also covers off-diagonal doubling, L-shaped patterns, and arbitrary subsets.

**Impact:** -10 lines across triangle + diagonal + off-diagonal patterns.

---

## Combined Summary (FEAT-1..17)

| Feature | Category | Lines | HW Latency | Effort |
|---------|----------|:---:|:---:|:---:|
| FEAT-1 `latency_hide` | Scheduling | 0 | **-10 to -20cc** | High |
| FEAT-2 `carry_chain` | Primitive | **-30** | -0 to -8cc | High |
| FEAT-3 `specialize` | Optimization | -3 | **-8cc** | Medium |
| FEAT-4 `for`-in-cycle | Syntax | **-15** | 0 | Low |
| FEAT-5 `normalize` | Primitive | **-20** | 0 | Medium |
| FEAT-6 `triangle` | Pattern | **-10** | 0 | Medium |
| FEAT-7 `broadcast` impl | Primitive | -5 | -0 to -8cc | Medium |
| FEAT-8 Range coords | Syntax | **-10** | 0 | Low |
| FEAT-9 Inline arith | Syntax | -5 | 0 | Low |
| FEAT-10 `stash` | Scheduling | -5 | -0 to -8cc | High |
| FEAT-11 `extract(axis)` | Unification | -7 | 0 | Low |
| FEAT-12 `collect` | Pattern | **-12** | 0 | Medium |
| FEAT-13 `accumulate` | Pattern | **-30** | 0 | High |
| FEAT-14 `conditional_sub` | Domain | -3 | 0 | Medium |
| FEAT-15 Row auto-broadcast | Syntax | -6 | 0 | Low |
| FEAT-16 Pipeline macro | Abstraction | -5 | 0 | Low |
| FEAT-17 `guard` condition | Syntax | **-10** | 0 | Low |
| **Total** | | **~-176 lines** | **-18 to -44cc** | — |

Current kernel: **328 lines / 269 instr / 340 hwcc**.
With all features: **~152 lines / 265-269 instr / 296-322 hwcc** (estimated).

---
---

# Known Compiler Bugs

## BUG-1: Style A' Row Auto-Broadcast Corrupts When Mixed With Other Styles

**Severity:** High — silently produces wrong results (no compile error).

**Description:** Style A' (`row N: instr;` → auto-broadcast to all 4 columns) exists in the parser (`parseRowInstructions`) but produces **incorrect simulation output** when the same `cycle { }` block also contains:
- Another row with Style A pipe-varied instructions (`row M: a | b | c | d;`)
- Direct coordinate instructions (`@r,c: instr;`)

**Reproduction:**

```c
// WORKS — row 1 alone in cycle or with @-coords that don't conflict:
cycle {
    @0,3: LWI R0, 4;
    row 1: SMUL R2, R0, R1;   // ✅ Style A' broadcast OK
}

// FAILS — row 1 broadcast mixed with pipe-varied row 0:
cycle {
    row 0: SRT R3, R0, 16 | LWI R1, mu[0] | LWI R1, mu[0] | LWI R1, mu[0];
    row 1: LWI R1, mu[1];     // ❌ Style A' broadcast WRONG OUTPUT
}

// FAILS — row 0 broadcast mixed with another broadcast row 1:
cycle {
    row 0: SADD R2, R0, ZERO; // ❌ broadcast
    row 1: LWI R1, p_limbs[1]; // This one works, but row 0 doesn't
}
```

**Test results (each broadcast tested individually, 12 test vectors):**

| Broadcast | Cycle Context | Pass/Fail |
|-----------|--------------|:---------:|
| `row 1: LWI R1, p_limbs[1]` | Cycle with 2 broadcast rows | ✅ 12/12 |
| `row 1: SMUL R2, R0, R1` | Cycle with `@0,3:` + broadcast row | ✅ 12/12 |
| `row 1: LWI R1, mu[1]` | Cycle with pipe-varied row 0 | ❌ 4/12 |
| `row 2: LWI R1, mu[2]` | Cycle with pipe-varied row 0 | ❌ 4/12 |
| `row 1: SADD R3, RCB, ZERO` | Cycle with `@0,0:` + broadcast | ❌ 5/12 |
| `row 0: SADD R2, R0, ZERO` | Cycle with broadcast row 1 | ❌ 2/12 |

**Suspected root cause:** The `{ ...firstInstr }` shallow copy in `parseRowInstructions` (Style A' branch) may create aliased Instruction objects. When the code generator later mutates instruction fields (e.g., resolving named array addresses), all 4 "copies" share the same nested object references, causing overwrites.

**Workaround:** Use explicit pipe syntax: `row N: instr | instr | instr | instr;`

---

## BUG-2: Lexer Does Not Tokenize `&` Operator — ✅ RESOLVED

**Severity:** Medium — blocks `R0 = R1 & 65535` expression syntax for `LAND`.

**Status:** ✅ **RESOLVED** (commit `62b0f8e` in UMA-CGRA-Simulator)

**Root cause:** The simulator was importing from a stale copy at `libs/OpenEdgeDSL/` whose `patterns.ts` was missing `&`, `^`, `~` from `SINGLE_CHAR_OPERATORS`. The OpenEdgeDSL repo itself already had these operators.

**Resolution:** Changed `vite.config.ts` and `tsconfig.app.json` to import from the sibling submodule (`../OpenEdgeDSL/src`) instead of the stale `libs/` copy. Verified: `LAND R0,R1,65535` and `LXOR R0,R1,R2` now compile correctly.

**Original description:** The expression desugarer (`expression-desugar.ts`) maps `&` → `LAND`, but the stale lexer copy did not recognize `&` as a valid operator character.

**Affected operators from `OPERATOR_TO_OPCODE`:**

| Operator | Target ISA | Status |
|----------|-----------|--------|
| `&` | `LAND` | ✅ Fixed |
| `\|` | `LOR` | ⚠️ Ambiguous with pipe separator |
| `^` | `LXOR` | ✅ Fixed |
| `~&` | `LNAND` | ✅ Fixed (via submodule) |
| `~\|` | `LNOR` | ⚠️ Ambiguous with pipe separator |
| `~^` | `LXNOR` | ✅ Fixed (via submodule) |

---

## BUG-3: Expression Desugarer Not Invoked by UMA-CGRA-Simulator Pipeline — ✅ RESOLVED

**Severity:** Critical — C-style expression syntax was **completely non-functional** in the simulation workflow.

**Status:** ✅ **RESOLVED** (commit `62b0f8e` in UMA-CGRA-Simulator)

**Resolution:** Added `desugarExpressions()` and `desugarAutoCycle()` to the simulator's `dsl-compiler.ts` pipeline. Verified: all expression patterns (`+`, `-`, `*`, `>>`, `<<`, `&`, `^`, copy) now compile correctly.

**Description:** The expression desugarer pass (`desugarExpressions()`) exists and is correctly wired into **OpenEdgeDSL's own** `compileDslToCsv()` (in `compiler.ts`, lines 139 and 197). However, the **UMA-CGRA-Simulator** has its own `compileDslToCsv()` wrapper in `src/utils/dsl-compiler.ts` that reimplements the compilation pipeline as:

```
tokenize() → parse() → generateCsvFromAst()
```

This pipeline **skips the `desugarExpressions()` pass** entirely. The OpenEdgeDSL compiler's correct pipeline is:

```
tokenize() → desugarExpressions() → desugarAutoCycle() → parse() → generateCsvFromAst()
```

**Impact:** ALL C-style expression patterns fail when compiled through the simulator:

```c
// ALL of these fail with "Expected SEMICOLON, but found IDENTIFIER":
R1 = R0 + R2;    // SADD
R1 = R0;          // copy
R0 = R1 >> 16;    // SRT
R0 = R1 << 8;     // SLT
R1 = R0 - R2;     // SSUB
R2 = R0 * R1;     // SMUL
ROUT = RCR;       // copy via neighbor
```

**Root cause:** `UMA-CGRA-Simulator/src/utils/dsl-compiler.ts:121` calls `parse(tokens)` directly on raw tokens without desugar passes.

**Fix:** Add the missing desugar passes to the simulator's pipeline:

```diff
 export function compileDslToCsv(dslCode: string): CompilationResult {
   try {
     const tokens = tokenize(dslCode);
-    const { ast, symbols } = parse(tokens);
+    const desugared = desugarExpressions(tokens);
+    const autoCycled = desugarAutoCycle(desugared);
+    const { ast, symbols } = parse(autoCycled);
```

Or better: import and use OpenEdgeDSL's own `compileDslToCsv` directly instead of reimplementing the pipeline.

---

## BUG-4: Simulator Pipeline Missing 7 Code-Generating Pragmas — ⚠️ PARTIALLY RESOLVED

**Severity:** Medium — these pragmas exist and work in OpenEdgeDSL's `compiler.ts` but are absent from the simulator's `dsl-compiler.ts`.

**Status:** ⚠️ **PARTIALLY RESOLVED** (commit `62b0f8e` in UMA-CGRA-Simulator)

**Resolution:** The submodule path fix (BUG-5) makes the updated OpenEdgeDSL lexer and types available, and the desugar passes were added (BUG-3). However, the simulator's `dsl-compiler.ts` still maintains its own `parse()` function that only handles 5 of the 12 code-generating pragmas. The 7 missing pragmas (`rotate`, `shift`, `allreduce`, `transpose`, `gather`, `stream_load`, `stream_store`) still need to be added to the simulator's `parseBlock()` function, or the whole pipeline should be replaced with OpenEdgeDSL's `compileDslToCsv()` directly.

**Description:** The UMA-CGRA-Simulator's `dsl-compiler.ts` is a **partial copy** of OpenEdgeDSL's `compiler.ts`. The simulator copy has fallen behind and is missing 7 code-generating pragmas that were added to OpenEdgeDSL.

**Feature Parity Table:**

| Pragma | OpenEdgeDSL | Simulator | Status |
|--------|------------|-----------|--------|
| `#pragma reduce` | ✅ | ✅ | In sync |
| `#pragma stencil` | ✅ | ✅ | In sync |
| `#pragma route` | ✅ | ✅ | In sync |
| `#pragma scan` | ✅ | ✅ | In sync |
| `#pragma broadcast` | ✅ | ✅ | In sync |
| `#pragma rotate` | ✅ | ❌ | **Missing** |
| `#pragma shift` | ✅ | ❌ | **Missing** |
| `#pragma allreduce` | ✅ | ❌ | **Missing** |
| `#pragma transpose` | ✅ | ❌ | **Missing** |
| `#pragma gather` | ✅ | ❌ | **Missing** |
| `#pragma stream_load` | ✅ | ❌ | **Missing** |
| `#pragma stream_store` | ✅ | ❌ | **Missing** |
| `desugarExpressions()` | ✅ | ❌ | **BUG-3** |
| `desugarAutoCycle()` | ✅ | ❌ | **BUG-3** |

**Non-code-generating features (in sync):** `#pragma parallel collapse`, `#pragma unroll`, `#pragma no_unroll`, `#pragma no_fuse`, `for`/`while`/`if-else` loops, functions, directives, labels, `.assert`.

**Root cause:** The simulator maintains a duplicated parser (`parse()` function) instead of importing OpenEdgeDSL's `compileDslToCsv()` directly. As new features are added to OpenEdgeDSL, the simulator copy falls behind.

**Fix:** Same as BUG-3 — replace the simulator's reimplemented pipeline with a direct import of OpenEdgeDSL's `compileDslToCsv()`. This would permanently eliminate the synchronization gap.

---

## BUG-5: Stale `libs/OpenEdgeDSL/` Copy — Unified Root Cause of BUG-2, BUG-3, BUG-4 — ✅ RESOLVED

**Severity:** Critical — this was the **single root cause** underlying bugs 2, 3, and 4.

**Status:** ✅ **RESOLVED** (commit `62b0f8e` in UMA-CGRA-Simulator)

**Resolution:** Changed `vite.config.ts` and `tsconfig.app.json` to point `@core/dsl` at the sibling submodule (`../OpenEdgeDSL/src`) instead of the stale `libs/OpenEdgeDSL/` copy. The `libs/` copy is no longer used at runtime. Added `desugarExpressions()` + `desugarAutoCycle()` to the compilation pipeline.

**Description:** The UMA-CGRA-Simulator imports OpenEdgeDSL via:

```typescript
// vite.config.ts:16
'@core/dsl': path.resolve(__dirname, './libs/OpenEdgeDSL/src')
```

This `libs/OpenEdgeDSL/` directory is a **manual copy** of the OpenEdgeDSL source, NOT a symlink or git submodule reference. It has fallen massively behind the current OpenEdgeDSL codebase:

| Metric | Count |
|--------|-------|
| Modified files | 28 |
| New files (only in OpenEdgeDSL) | 27 |
| Total divergences | **55** |

**Specific lexer operator drift (`patterns.ts`):**

| Feature | `libs/` copy (stale) | OpenEdgeDSL (current) |
|---------|---------------------|----------------------|
| `SINGLE_CHAR_OPERATORS` | `+ - * / %` | `+ - * / % & ^ ~` |
| `MULTI_CHAR_OPERATOR_STARTS` | `= ! < >` | `= ! < > ~ *` |
| `TWO_CHAR_OPERATORS` | `== != <= >=` | `== != <= >= << >> ** ~& ~\| ~^` |
| `THREE_CHAR_OPERATORS` | ❌ doesn't exist | `>>>` |

**Missing files in `libs/` copy (critical subset):**

| File | Function |
|------|----------|
| `parser/auto-cycle-desugar.ts` | `#pragma auto_cycle` support (BUG-3) |
| `parser/expression-desugar.ts` | C-style expression syntax (BUG-3) |
| `parser/allreduce-generator.ts` | `#pragma allreduce` (BUG-4) |
| + 4 more code-gen pragmas | BUG-4 |

**Fix (recommended):** Replace `libs/OpenEdgeDSL/` with a symlink to `../../submodules/OpenEdgeDSL/src/`, or change `vite.config.ts` to point to the submodule directly:

```diff
-'@core/dsl': path.resolve(__dirname, './libs/OpenEdgeDSL/src'),
+'@core/dsl': path.resolve(__dirname, '../../submodules/OpenEdgeDSL/src'),
```

This would permanently eliminate all synchronization issues and resolve BUG-2, BUG-3, and BUG-4 in a single change.
