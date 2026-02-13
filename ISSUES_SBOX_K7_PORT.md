# OpenEdgeDSL Compiler Issues — Discovered During SBOX K7 v6 Porting

Discovered while porting `sbox_k7_v5_rout.edsl` → `sbox_k7_v6_compact.edsl`.

---

## Status Snapshot (2026-02-13)

Current tracking has been consolidated in:

- `docs/issue-status-matrix.md` (OpenEdgeDSL vs UMA-CGRA-Simulator vs docs)
- `docs/issue-closure-roadmap.md` (tasks, subtasks, timeline, rationale, evidence)

Quick summary:

- **Resolved in OpenEdgeDSL (verified by tests):** Issue 1, 2, 3, 5, 6, 9, 10, 12 and BUG-1, BUG-6, BUG-7, BUG-8, BUG-9.
- **Resolved in simulator sync:** BUG-3/4 and wrapper parity guardrails for BUG-5.
- **Canonical-intentional (not bugs in canonical-only mode):** legacy `#pragma` workflow items (Issue 4, 7, 8, 11 and related REG sections).

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

## Issue 3: C-like expressions fail in multi-`@` cycle blocks — ✅ RESOLVED (2026-02-13)

**Symptom:**
```
Expected SEMICOLON, but found IDENTIFIER('R2')
```
when writing `@0,0: R3 = R2; @0,1: R3 = R2;` inside a cycle.

**Root cause:** The expression desugarer doesn't parse C-like expressions when multiple `@row,col:` instructions coexist on the same line separated by `;`.

**Workaround:** Use assembly syntax (`SADD R3, R2, ZERO`) for all instructions in multi-`@` cycle blocks.

**Impact:** C-like expressions are essentially limited to single-PE-per-line cycle blocks, heavily restricting their usefulness in real kernels.

---

## Issue 4: C-like expressions fail inside `row N:` pipe syntax — ℹ️ CANONICAL-INTENTIONAL

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

## Issue 7: `#pragma auto_cycle` doesn't work inside functions — ℹ️ CANONICAL-INTENTIONAL

**Symptom:** `#pragma auto_cycle` inside function bodies causes:
```
Expected KEYWORD('cycle'), but found AT_SYMBOL('@')
```

**Root cause:** Same as Issue 1 — function expansion prefixes tokens with `_funcname_N_` before `auto_cycle` processing. The auto_cycle pass can't find PE prefixes (`@row,col:`) after they've been mangled.

**Note:** `#pragma route` and `#pragma parallel` DO work inside functions. Only `auto_cycle` is affected.

**Workaround:** Use `auto_cycle` only at the kernel level, or write explicit `cycle { }` wrappers inside functions.

---

## Issue 8: `#pragma parallel` (without `collapse`) generates serial cycles — ℹ️ CANONICAL-INTENTIONAL

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

## Issue 10: `for` loop variable name `col` triggers parse error — ✅ RESOLVED (2026-02-13)

**Symptom:**
```
Expected identifier for loop variable, got 'col'
```
when writing `for col in range(1, 4) { ... }`

**Root cause:** `col` is treated as a reserved keyword (from the `col N:` broadcast syntax) rather than as a valid loop variable identifier.

**Workaround:** Use a different variable name: `for c in range(...)` or `for j in range(...)`.

---

## Issue 11: `#pragma parallel collapse` generates isolated cycles that can't merge with other instructions — ℹ️ CANONICAL-INTENTIONAL

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

### OPT-A: Cycle Packing — Post-Compilation Instruction Scheduling — ✅ RESOLVED (2026-02-13)

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

**Implementation in canonical compiler:**
- Implemented via canonical statement `latency_hide(window=..., mode=conservative)`.
- Lowering executes deterministic post-expansion cycle packing with explicit hazard guards.
- Contract tests verify positive packing and non-packing safety cases.

**Estimated impact:** -8 to -12 cycles (3-4% reduction). The gains are modest because most serial sections have genuine data dependencies. The independent cycles are scattered in the normalization and route setup phases.

**Complexity:** Medium — already implemented in conservative deterministic form (no ILP/autoscheduler).

**Evidence:** `tests/issues/opt-a-cycle-packing.test.ts`, `tests/issues/feat-01-latency-hide.test.ts`, `tests/compiler-api.latency-hide.test.ts`.

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

## FEAT Tracking (Operational)

Operational source of truth for FEAT status and execution is:

- `docs/issue-status-matrix.md`
- `docs/issue-closure-roadmap.md#feat-portfolio-117`

Snapshot sync (2026-02-13):

| FEAT | Operational status | Roadmap block |
|---|---|---|
| FEAT-1 | resolved-verified | WS-20 |
| FEAT-2 | resolved-verified | WS-18 |
| FEAT-3 | resolved-verified | WS-09 |
| FEAT-4 | resolved-verified | WS-04 / portfolio |
| FEAT-5 | resolved-verified | WS-14 |
| FEAT-6 | resolved-verified | WS-10 |
| FEAT-7 | resolved-verified | portfolio |
| FEAT-8 | resolved-verified | WS-07 |
| FEAT-9 | resolved-verified | WS-08 |
| FEAT-10 | resolved-verified | Block A |
| FEAT-11 | resolved-verified | WS-15 |
| FEAT-12 | resolved-verified | WS-13 |
| FEAT-13 | resolved-verified | WS-16 |
| FEAT-14 | resolved-verified | WS-17 |
| FEAT-15 | resolved-verified | WS-11 |
| FEAT-16 | resolved-verified | WS-19 |
| FEAT-17 | resolved-verified | WS-12 |

---

## 🔴 HIGH IMPACT — Latency Reduction

### FEAT-1: `latency_hide(...)` — Latency-Aware Instruction Scheduling — ✅ RESOLVED (2026-02-13)

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
latency_hide(window=1, mode=conservative);
cycle { at row 1: SMUL R2, R0, R1; }  // 3cc, row 0 idle
cycle { @0,3: LWI R1, 4; }            // compiler can compact this into the previous cycle when hazards allow
```

**Canonical implementation status:** available as deterministic conservative post-expansion compaction with explicit legality checks (PE overlap, route boundaries, control barriers, dual-memory adjacency).

---

### FEAT-2: `carry_chain(...)` — Carry Propagation Primitive — ✅ RESOLVED (2026-02-13)

**Problem:** The `build_limbs` carry chain (lines 131-139) is 8 hand-written cycles with a repeating `LAND → SADD RCL → SWI → SRT` pattern. Data-dependent but structurally regular.

**Current (8 cycles, 8 lines):**
```c
cycle { @0,0: LAND R0, R0, 65535; @0,1: SADD R0, R0, RCL; }
cycle { @0,0: SWI R0, L[0]; @0,1: SRT R3, R0, 16; }
cycle { @0,1: LAND R0, R0, 65535; @0,2: SADD R0, R0, RCL; }
cycle { @0,1: SWI R0, L[1]; @0,2: SRT R3, R0, 16; }
// ... repeats for L[2], L[3], L[4]
```

**Canonical implementation:**
```c
carry_chain(src=R0, carry=R3, store=L, limbs=4, width=16, row=0);
carry_chain(src=R4, carry=R5, store=L, limbs=2, width=8, mask=255, row=1, start=3, dir=left);
```

**Impact:** -30 lines via a deterministic primitive that removes hand-written carry boilerplate.

**Canonical implementation status:** available as deterministic per-limb staged lowering (`SADD`, `LAND`, `SWI`, `SRT`) with explicit geometry diagnostics.

---

### FEAT-3: `#pragma specialize` — Constant Specialization — ✅ RESOLVED (2026-02-13)

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

### FEAT-5: `normalize(...)` — Base-2^16 Normalization — ✅ RESOLVED (2026-02-13)

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
normalize(reg=R3, carry=R1, width=16, lane=0, axis=row, dir=right);
```

**Impact:** -20 lines. Abstracts the most common pattern in multi-limb CGRA arithmetic.

**Canonical implementation status:** implemented as deterministic four-cycle lane lowering (`SRT`, `LAND`, carry relay, lane add) with NxM row/column support and explicit diagnostics.

---

### FEAT-6: `#pragma triangle` — Upper/Lower Triangle Patterns — ✅ RESOLVED (2026-02-13)

**Problem:** The Karatsuba upper-triangle SMUL (lines 90-95) maps 10 PEs where `col >= row`. Cannot be expressed with a single `for` because the condition is 2D.

**Current (5 lines):**
```c
row 0: SMUL R2, R0, R1 | SMUL R2, R0, R1 | SMUL R2, R0, R1 | SMUL R2, R0, R1;
row 1: _ | SMUL R2, R0, R1 | SMUL R2, R0, R1 | SMUL R2, R0, R1;
@2,2: SMUL R2, R0, R1; @2,3: SMUL R2, R0, R1;
@3,3: SMUL R2, R0, R1;
```

**Canonical implementation (1 line):**
```c
triangle(shape=upper, inclusive=true, op=SMUL, dest=R2, srcA=R0, srcB=R1);
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

### FEAT-8: Range Coordinate Syntax — `@0,0..3` (Issue #7) — ✅ RESOLVED (2026-02-13)

**Problem:** Every multi-PE instruction requires explicit coordinate listing.

**Current:** `@0,0: SADD R3, ZERO, ZERO; @0,1: SADD R3, ZERO, ZERO; @0,2: SADD R3, ZERO, ZERO; @0,3: SADD R3, ZERO, ZERO;`

**Proposed:** `@0,0..3: SADD R3, ZERO, ZERO;`

**Impact:** -10 lines across kernel.

---

### FEAT-9: Inline Operand Arithmetic — ✅ RESOLVED (2026-02-13)

**Problem:** Memory operands don't support arithmetic. Must use `.data` named arrays or `.const` workarounds.

**Current:** `.data L 360 { 0, 0, 0, 0, 0 }` then `LWI R0, L[j]`
**Could be:** `LWI R0, 360 + j*4` (if inline arithmetic were supported)

**Impact:** -5 lines (eliminate buffer declarations).

---

### FEAT-10: `stash(...)` — Register Lifetime Extension Baseline — ✅ RESOLVED (2026-02-13)

**Problem:** Values like `L[0..1]` and `mu[0]` are needed across function boundaries but get overwritten by intermediate operations. Manual stashing to an idle row/column was verbose and error-prone.

**Canonical statement (implemented):**
```c
stash(action=save, reg=R0, addr=L[0], target=point(3,0));
stash(action=restore, reg=R1, addr=L[0], target=point(3,0));
```

Implemented semantics:

- deterministic one-cycle lowering per statement;
- `save` -> `SWI reg, addr`, `restore` -> `LWI reg, addr`;
- target selection supports `all`, `row(N)`, `col(N)`, `point(r,c)`;
- strict coordinate diagnostics for out-of-bounds targets.

**Evidence:** `tests/issues/feat-10-stash.test.ts`, `tests/compiler-api.collective-builders.test.ts`, `tests/compiler-api.expand-pragmas.handlers.test.ts`, `tests/compiler-api.passes-shared.test.ts`.

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

### FEAT-11: Parameterized Byte Extraction — `extract_bytes(...)` — ✅ RESOLVED (2026-02-13)

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

**Canonical implementation:**
```c
extract_bytes(src=R0, dest=R1, axis=col);                 // default byteWidth=8, mask=255
extract_bytes(src=R2, dest=R3, axis=row, byteWidth=4, mask=15);
```

**Impact:** -7 lines.

**Canonical implementation status:** available as deterministic 2-cycle full-grid lowering (`SRT`, `LAND`) parameterized by `axis`, `byteWidth`, and `mask`.

---

### FEAT-12: `collect(...)` — Cross-Row/Column Value Collection — ✅ RESOLVED (2026-02-13)

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
collect(from=row(1), to=row(0), via=RCB, local=R2, into=R3, combine=shift_add);
```

**Impact:** -12 lines across 3 instances.

**Canonical implementation status:** available via advanced statement lowering in the compiler core with deterministic NxM behavior and explicit diagnostics for invalid geometry/via direction.

---

### FEAT-13: `accumulate(...)` — Product Accumulation Networks — ✅ RESOLVED (2026-02-13)

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

**Canonical implementation:**
```c
accumulate(pattern=anti_diagonal, products=R2, accum=R3, out=ROUT, combine=add);
accumulate(pattern=row, products=R2, accum=R3, out=ROUT, combine=xor);
accumulate(pattern=col, products=R2, accum=R3, out=ROUT, combine=sub);
```

**Impact:** -30 lines in the original block while keeping deterministic NxM lowering and explicit staged behavior.

**Canonical implementation status:** available as advanced statement lowering in the compiler core with deterministic stage ordering for `row`, `col`, and `anti_diagonal` patterns.

---

### FEAT-14: `conditional_sub(...)` — Branchless Conditional Subtraction — ✅ RESOLVED (2026-02-13)

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

**Canonical implementation:**
```c
conditional_sub(value=R0, sub=R1, dest=R2);
conditional_sub(value=R4, sub=R5, dest=R6, target=row(1));
conditional_sub(value=R7, sub=R1, dest=R0, target=point(1,2));
```

**Impact:** preserves branchless semantics while removing repeated boilerplate and keeping intent explicit.

**Canonical implementation status:** available as deterministic two-stage lowering (`SSUB`, `BSFA`) over configurable spatial targets.

---

### FEAT-15: Row Auto-Broadcast Syntax — ✅ RESOLVED (2026-02-13)

**Problem:** When all 4 PEs in a row execute the same instruction, the current syntax requires repeating it 4 times with `|`:

**Current:**
```c
row 1: LWI R1, mu[1] | LWI R1, mu[1] | LWI R1, mu[1] | LWI R1, mu[1];
```

**Canonical implementation:** when a row has a single instruction (no `|` separators), it auto-expands to all columns:
```c
at row 1: LWI R1, mu[1];  // → all 4 cols
```

This is distinct from FEAT-8 (range coords). FEAT-8 targets `@row,col..col` coordinate ranges; FEAT-15 targets the **visual pipe** row syntax.

**Impact:** -6 lines across mu preload (lines 127-129), p_limbs load (line 197), SMUL rows.

---

### FEAT-16: `pipeline(...)` — Function Sequence Macro — ✅ RESOLVED (2026-02-13)

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

**Canonical implementation:**
```c
pipeline(
  build_limbs_base16_from_regs(),
  compute_qhat_inregs(),
  mul_qhat_p_inregs(),
  compute_r_inregs(out_addr)
);
```

**Impact:** -5 lines while keeping composition explicitly function-based and canonical.

**Canonical implementation status:** available as parser-level expansion to ordered fn-call statements (`pipeline(fnA(...), fnB(...), ...)`), with strict validation that each entry is a canonical function call.

---

### FEAT-17: `#pragma guard(condition)` — Conditional PE Activation in Loops — ✅ RESOLVED (2026-02-13)

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

**Canonical implementation:**
```c
guard(cond=col>=row, op=SMUL, dest=R2, srcA=R0, srcB=R1);
guard(cond=col==row, op=SADD, dest=R3, srcA=ZERO, srcB=ZERO);
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

## BUG-4: Simulator Pipeline Missing 7 Code-Generating Pragmas — ✅ RESOLVED

**Severity:** Medium — these pragmas exist and work in OpenEdgeDSL's `compiler.ts` but were absent from the simulator's `dsl-compiler.ts`.

**Status:** ✅ **RESOLVED** (commit `571da03` in UMA-CGRA-Simulator)

**Resolution:** The simulator's 660-line reimplemented `dsl-compiler.ts` was replaced with a thin re-export wrapper that delegates to OpenEdgeDSL's canonical `compiler.ts`. All 12 code-generating pragmas are now available in the simulator.

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

---

## BUG-6: Expression Desugarer Does Not Recognize Function Parameter Names — ✅ RESOLVED

**Severity:** Medium — limits expression syntax adoption in parameterized functions.

**Status:** 🟡 **OPEN**

**Description:** The expression desugarer (`parser/expression-desugar.ts`) uses a hardcoded `VALID_OPERAND_IDENTIFIERS` set to determine which tokens are valid expression operands:

```typescript
const VALID_OPERAND_IDENTIFIERS = new Set([
  'R0', 'R1', 'R2', 'R3', 'ROUT', 'ZERO',
  'SELF', 'RCL', 'RCR', 'RCT', 'RCB', 'PREV',
]);
```

This means **function parameter names** (e.g., `src`, `dst`, `reg`, `addr`) are not recognized as valid operands. Expression syntax only works with literal register names.

**Reproduction:**

```c
// FAILS — 'dst' and 'src' not in VALID_OPERAND_IDENTIFIERS
function extract_bytes(src, dst) {
    cycle { @0,0: dst = src >> 16; }   // Error: Expected SEMICOLON, found IDENTIFIER('src')
    cycle { @0,0: dst = dst & 255; }   // Error: same
}

// WORKS — literal register names
function compute() {
    cycle { @0,0: R1 = R0 >> 16; }    // OK — R0, R1 are in the set
    cycle { @0,0: R1 = R1 & 255; }    // OK
}
```

**Impact:** In the SBOX K7 v8 kernel, `extract_bytes_col` and `extract_bytes_row` cannot use expression syntax because they use function parameters `src` and `dst`. They must remain as native ISA:

```c
// Must use native ISA (SRT/LAND) instead of expression syntax
function extract_bytes_col(src, dst) {
    cycle { @k/4,k%4: SRT dst, src, k%4*8; }   // Can't write: dst = src >> k%4*8;
    cycle { @k/4,k%4: LAND dst, dst, 255; }     // Can't write: dst = dst & 255;
}
```

**Root cause:** The desugarer runs as a **token-level transform** (before parsing/function expansion). At this stage, function parameters have not been substituted yet — `src` and `dst` are still generic identifiers, not register names.

**Fix options:**

1. **Move desugaring after function expansion** — desugarer would see `R0`, `R1` etc. after parameter substitution. Requires pipeline restructuring.
2. **Add function parameter names to `VALID_OPERAND_IDENTIFIERS`** — quick but fragile; would need to dynamically detect parameter names from function definitions.
3. **Accept any identifier as a valid operand in expressions** — broadest fix, but risks false-positive matching on non-register identifiers (array names, constants, etc.).

---

## BUG-7: v3 Compiler Rejects Computed Loop-Variable Coordinates in `for { cycle {} }` — ✅ RESOLVED (2026-02-13)

**Severity:** Critical — blocks all parallel-collapse patterns in the SBOX K7 kernel.

**Status:** 🔴 **OPEN**

**Description:** The v3 structured parser (`E2002`) rejects `for` loop variables used as coordinates in `@row,col` placement inside cycle blocks. Both the short form (`@0,i:`) and canonical form (`at @0,i:`) fail.

**Reproduction:**

```dsl
target "uma-cgra-base";
kernel "T" {
  for i in range(4) {
    cycle { @0,i: NOP; }          // E2002: Invalid inline cycle statement
  }
  cycle { @0,0: EXIT; }
}
```

Also fails with computed expressions:

```dsl
for k in range(16) {
  cycle { @k/4,k%4: NOP; }       // E2002: Invalid inline cycle statement
}
```

**What works:**

| Pattern | Status |
|---|---|
| `for i in range(N) { cycle { @0,0: ... } }` (fixed coords) | ✅ OK |
| `for R0 in range(0,N) at @0,0 runtime { ... }` (runtime form) | ✅ OK |
| `for i in range(N) { cycle { at row 0: ... } }` (row broadcast) | ✅ OK |
| `for i in range(N) { cycle { @0,i: ... } }` (variable coord) | ❌ FAIL |
| `for k in range(16) { cycle { @k/4,k%4: ... } }` (computed coord) | ❌ FAIL |

**Impact:** The SBOX K7 kernel uses `for k in range(16) { cycle { @k/4,k%4: ... } }` extensively (6 occurrences via `#pragma parallel collapse` in v2) to distribute work across the 4×4 PE grid. Without this pattern, all 16-PE parallel operations must be manually unrolled to explicit `@r,c:` placements.

**Affected kernel functions:**
- `load_all(reg, addr)` — loads value into all 16 PEs
- `extract_bytes_col(src, dst)` — extracts bytes with column-dependent shifts
- `extract_bytes_row(src, dst)` — extracts bytes with row-dependent shifts
- `compute_qhat_inregs()` — 12-PE convolution (3×4)
- `mul_qhat_p_inregs()` — 4-PE copy and normalize
- `compute_r_inregs()` — 2-PE remainder

**Workaround:** Manual unrolling — replace each `for k in range(N) { cycle { @k/4,k%4: ... } }` with N explicit cycle+PE lines.

**Root cause (likely):** The v3 structured parser validates cycle statement coordinates as numeric literals or `@row,col` constants during parsing, before the for-loop expansion pass has substituted the loop variable values. The v2 parser performed for-loop expansion at the token level before spatial validation.

**Fix:** The for-expansion pass should run before (or be integrated with) the cycle statement validator, so that computed coordinates like `@k/4,k%4` are resolved to concrete `@0,0`, `@0,1`, etc. before validation.

---

## BUG-8: v3 Compiler Hoists `route()` Statement to Beginning of Kernel — ✅ RESOLVED (2026-02-13)

**Severity:** High — breaks data-dependent routing in all kernels using inline `route()`.

**Status:** 🔴 **OPEN**

**Description:** The v3 compiler's `route()` statement expands to ROUT chain cycles that are placed at the **very beginning** of the kernel, before any user-defined cycles. This breaks data dependencies when `route()` is called mid-kernel (e.g., after computing values that need to be routed).

**Reproduction:**

```dsl
target "uma-cgra-base";
kernel "T" {
    cycle { @0,0: SADD R0, ZERO, IMM(1); }   // C0: R0 = 1
    cycle { @0,0: SADD R1, ZERO, IMM(2); }   // C1: R1 = 2
    route(@0,0 -> @0,1, payload=R0, dest=R2, op=SADD(R2, INCOMING, ZERO));
    cycle { @0,0: EXIT; }
}
```

**Expected:** Route expands at C2-C3 (after R0 and R1 are set).
**Actual:** Route expands at C0-C1 (before R0 and R1 are set), using uninitialized registers.

**Impact:** In the SBOX K7 kernel, `route(@0,1 -> @0,3, payload=R1, dest=R0, ...)` inside `compute_qhat_inregs()` runs before the quotient limbs are computed, routing garbage values.

**Workaround:** Replace `route()` with manual ROUT chain cycles:

```dsl
// route(@0,1 -> @0,3, payload=R1, dest=R0, op=SADD(R0, INCOMING, ZERO));
// becomes:
cycle { @0,1: ROUT = R1; }
cycle { @0,2: ROUT = RCL; }
cycle { @0,3: R0 = RCL; }
```

---

## BUG-9: v3 Structured Parser is Line-Oriented — Multi-Statement Lines Break Function Expansion — ✅ RESOLVED (2026-02-13)

**Severity:** Medium — affects code style and readability, not functionality if rules are followed.

**Status:** 🔴 **OPEN**

**Description:** The v3 structured parser requires **one `@r,c:` statement per line** inside cycle blocks. Multiple semicolon-separated statements on the same line are treated as a single instruction text, causing concatenated instruction strings in the MIR output.

**Reproduction:**

```dsl
// WRONG: multiple @r,c: per line
cycle { @0,0: NOP; @0,1: NOP; @0,2: NOP; @0,3: NOP; }

// CORRECT: one @r,c: per line
cycle {
    @0,0: NOP;
    @0,1: NOP;
    @0,2: NOP;
    @0,3: NOP;
}
```

**Impact:** Kernel code formatting must follow one-statement-per-line convention. Multi-PE cycle blocks become significantly more verbose.

**Workaround:** Write all cycle blocks with one `@r,c:` per line.

---

# v8 → v9 Regression Analysis

> **Context:** The SBOX K7 kernel was ported from v8 (expression syntax + v2 `#pragma` compiler, 332 lines) to v9 (OpenEdgeDSL v3 canonical syntax, 615 lines). Both produce identical CSV output (269 cycles). This section documents every aspect that **got worse** in the transition.

## Summary

| Metric | v8 | v9 | Delta |
|---|---|---|---|
| Source lines | 332 | 615 | **+85%** |
| Source bytes | 12,135 | 13,979 | +15% |
| Cycle blocks with ≥4 PEs | ~18 | ~32 | +78% |
| Max statements per cycle block | 4 (one `row`) | 16 (explicit PEs) | **4× worse** |
| Bugs introduced during porting | — | 1 (PE placement) | — |
| Compiler workarounds needed | 0 | 3 (BUG-7, BUG-8, BUG-9) | — |

---

## REG-1: Loss of `#pragma parallel collapse` + Computed Coordinates

**Severity:** 🔴 Critical — largest single contributor to code bloat and error-proneness.

The v2 compiler supported `#pragma parallel collapse` with computed coordinates (`@k/4,k%4`), allowing a single `for` loop to address all 16 PEs. The v3 compiler rejects computed coordinates in `for` loops (BUG-7), forcing **manual unrolling** of every parallel pattern.

**v8 — 4 lines:**
```dsl
function load_all(reg, addr) {
    #pragma parallel collapse
    for k in range(16) {
        cycle { @k/4,k%4: LWI reg, addr; }
    }
}
```

**v9 — 20 lines:**
```dsl
function load_all(reg, addr) {
    cycle {
        @0,0: LWI reg, addr;
        @0,1: LWI reg, addr;
        @0,2: LWI reg, addr;
        @0,3: LWI reg, addr;
        @1,0: LWI reg, addr;
        @1,1: LWI reg, addr;
        @1,2: LWI reg, addr;
        @1,3: LWI reg, addr;
        @2,0: LWI reg, addr;
        @2,1: LWI reg, addr;
        @2,2: LWI reg, addr;
        @2,3: LWI reg, addr;
        @3,0: LWI reg, addr;
        @3,1: LWI reg, addr;
        @3,2: LWI reg, addr;
        @3,3: LWI reg, addr;
    }
}
```

**Impact:**
- `load_all`: 4 → 20 lines (5×)
- `extract_bytes_col`: 6 → 38 lines (6.3×)
- `extract_bytes_row`: 6 → 38 lines (6.3×)
- `compute_qhat_inregs` (LWI block): 4 → 14 lines (3.5×)
- `compute_qhat_inregs` (SMUL block): 4 → 14 lines (3.5×)
- `mul_qhat_p_inregs` (RCT block): 4 → 6 lines (1.5×)

Total: ~28 lines v8 → ~130 lines v9 just from this one regression.

The manual unrolling also **directly caused the porting bug** — the v9 `accumulate_c_square` had `@1,3` instead of `@1,1` because PE coordinates had to be written out by hand rather than computed. This bug would have been impossible with `#pragma parallel collapse`.

---

## REG-2: Loss of Row Broadcast Syntax (`row N: A | B | C | D`)

**Severity:** 🟠 High — significant readability loss for row-uniform or per-column patterns.

The v2 pipe syntax `row N: A | B | C | D` expressed a 4-PE row in a single line. The v3 compiler requires 4 separate `@r,c:` lines (BUG-9), each on its own source line.

**v8 — 1 line:**
```dsl
cycle { row 0: SADD R3, ZERO, RCL | SADD R3, R2, RCL | SADD R3, R2, RCL | SADD R3, R2, RCL; }
```

**v9 — 6 lines:**
```dsl
cycle {
    @0,0: R3 = ZERO + RCL;
    @0,1: R3 = R2 + RCL;
    @0,2: R3 = R2 + RCL;
    @0,3: R3 = R2 + RCL;
}
```

**Why it's worse:**
- You lose the ability to see the entire row pattern at a glance
- You lose the visual alignment of the pipe `|` separators that makes it obvious which column does what
- Mixed patterns (`_ | A | A | _` for selective NOP columns) become harder to spot because NOP columns are simply absent from the v9 source

**Lines affected:** `build_limbs` (2 occurrences), `compute_qhat` (4 occurrences), `mul_qhat_p` (5 occurrences), `accumulate_c_multiply` (6 occurrences) — ~17 `row` statements in v8 expand to ~68 `@r,c:` lines in v9.

---

## REG-3: Loss of Multi-Row Cycle Blocks

**Severity:** 🟠 High — destroys visual compactness of multi-row orchestration.

The v8 `row N: ... | ...` syntax allowed **multiple rows** in a single cycle block with each row on its own line. In v9, each PE must have its own `@r,c:` line.

**v8 — 5 lines:**
```dsl
cycle {
    row 0: SRT R3, R0, 16 | LWI R1, mu[0] | LWI R1, mu[0] | LWI R1, mu[0];
    row 1: LWI R1, mu[1] | LWI R1, mu[1] | LWI R1, mu[1] | LWI R1, mu[1];
    row 2: LWI R1, mu[2] | LWI R1, mu[2] | LWI R1, mu[2] | LWI R1, mu[2];
}
```

**v9 — 15 lines:**
```dsl
cycle {
    @0,0: R3 = R0 >> 16;
    @0,1: R1 = mu[0];
    @0,2: R1 = mu[0];
    @0,3: R1 = mu[0];
    @1,0: R1 = mu[1];
    @1,1: R1 = mu[1];
    @1,2: R1 = mu[1];
    @1,3: R1 = mu[1];
    @2,0: R1 = mu[2];
    @2,1: R1 = mu[2];
    @2,2: R1 = mu[2];
    @2,3: R1 = mu[2];
}
```

**Why it's worse:**
- The v8 version immediately shows "row 0 does something different from rows 1-2" — v9 requires counting lines
- Row-level intent (`row 0: shift | load | load | load`) is lost; you must scan 12 PE addresses to infer the pattern
- The v8 `row` keyword served as documentation — it stated the architectural intent

---

## REG-4: Loss of `#pragma route` → Manual ROUT Relay

**Severity:** 🟠 High — replaces a declarative intent statement with error-prone manual wiring.

The v2 `#pragma route (src) -> (dst) payload(R) dest(R) op(...)` expressed inter-PE data movement as a **single declarative statement**. The v3 `route()` exists but is hoisted to the kernel start (BUG-8), forcing manual relay coding.

**v8 — 1 line:**
```dsl
#pragma route (0,1) -> (0,3) payload(R1) dest(R0) op(SADD R0, INCOMING, ZERO)
```

**v9 — 9 lines:**
```dsl
// BUG-8 workaround: route() hoisted to kernel start
cycle {
    @0,1: ROUT = R1;
}
cycle {
    @0,2: ROUT = RCL;
}
cycle {
    @0,3: R0 = RCL;
}
```

**Why it's worse:**
- The programmer must manually compute the relay path (source → intermediate PEs → destination)
- No verification that the payload reaches the correct destination register
- The v8 pragma encoded **intent** (what data, where from, where to, what operation); the v9 manual chain encodes **mechanism** (raw ROUT/RCL instructions)
- Off-by-one errors in relay chain are invisible until runtime

---

## REG-5: Expression Syntax Forbidden in Function Bodies with Parameters

**Severity:** 🟡 Medium — forces mixing of syntax styles within the kernel.

The v3 expression desugarer does not handle function parameter names (`src`, `dst`, `reg`, `addr`) as valid operands (BUG-6). Functions that use parameters in arithmetic must use native ISA instead of expression syntax.

**v8 — expression syntax everywhere:**
```dsl
function extract_bytes_col(src, dst) {
    #pragma parallel collapse
    for k in range(16) {
        cycle { @k/4,k%4: dst = src >> k%4*8; }
        cycle { @k/4,k%4: dst = dst & 255; }
    }
}
```

**v9 — native ISA in function bodies:**
```dsl
function extract_bytes_col(src, dst) {
    cycle {
        @0,0: SRT dst, src, 0;
        @0,1: SRT dst, src, 8;
        // ... 14 more lines
    }
    cycle {
        @0,0: LAND dst, dst, 255;
        // ... 15 more lines
    }
}
```

**Why it's worse:**
- Functions that take register parameters cannot use expression sugar (`R1 = R0 >> 8` → must write `SRT R1, R0, 8`)
- This creates an inconsistent style within the same file: kernel body uses expressions, function bodies use native ISA
- The kernel body CAN use expressions because it uses concrete register names (`R0`, `R1`), not parameters

---

## REG-6: Loss of Selective NOP in Row Broadcast (`_` placeholder)

**Severity:** 🟡 Medium — reduces clarity of intentional NOP placement.

The v8 pipe syntax used `_` as a visual placeholder for intentional NOPs within a row. In v9, a NOP column is simply **absent** from the source, making it harder to verify that the omission is intentional.

**v8 — NOPs are visible:**
```dsl
cycle { row 0: SADD ROUT, R1, ZERO | SADD ROUT, R1, ZERO | SADD ROUT, R1, ZERO | _; }
cycle { row 0: _ | SADD R3, R3, RCL | SADD R3, R3, RCL | SADD R3, R3, RCL; }
```

**v9 — NOPs are invisible:**
```dsl
cycle {
    @0,0: ROUT = R1;
    @0,1: ROUT = R1;
    @0,2: ROUT = R1;
}
cycle {
    @0,1: R3 = R3 + RCL;
    @0,2: R3 = R3 + RCL;
    @0,3: R3 = R3 + RCL;
}
```

**Why it's worse:**
- In v8, `_` at column 3 signals "col 3 is intentionally idle" — the reader knows all 4 columns were considered
- In v9, column 3 is simply missing; the reader cannot distinguish "intentionally skipped" from "accidentally forgotten"
- This directly contributed to the PE placement bug (REG-1) — it's much harder to verify completeness when absent columns look identical to omitted ones

---

## REG-7: Loss of `config()` Statement

**Severity:** 🟢 Low — replaced by `target` declaration, which serves the same purpose.

The v2 `config(0xF, 0)` set the active column mask and DMA base address. In v3, the `target "uma-cgra-base"` declaration implicitly configures the grid. No functional regression, but the explicit `config()` call was more self-documenting for the active columns.

**v8:**
```dsl
kernel "SBox_k7_Full" {
    config(0xF, 0);
    ...
}
```

**v9:**
```dsl
target "uma-cgra-base";
// (implicit: all columns active, default DMA base)
kernel "SBox_k7_Full" {
    ...
}
```

---

## REG-8: Increased Bug Surface from Manual Unrolling

**Severity:** 🔴 Critical — the porting process itself introduced a correctness bug.

The v9 port introduced a PE placement bug (`@1,3` instead of `@1,1`) in the square accumulation function that made 8/12 tests fail. This bug was **structurally impossible** in v8 because computed coordinates (`@k/4,k%4`) are generated by the compiler, not typed by hand.

**The bug:**
```diff
- @1,2: R3 = R2 + RCT;    // WRONG: should be @1,1
- @1,3: R3 = R2 + RCT;    // WRONG: should be @1,2
+ @1,1: R3 = R2 + RCT;    // CORRECT
+ @1,2: R3 = R2 + RCT;    // CORRECT
```

**Root cause:** When manually expanding the v8 `row 1: _ | SADD R3, R2, RCT | SADD R3, R2, RCT | _` pattern to explicit `@r,c:` statements, the coordinates were mistyped. The `_` placeholders in v8 made the active columns (1,2) obvious; their absence in v9 made the error invisible.

**Lesson:** Every computed coordinate that must be manually unrolled in v3 is a potential bug site. The v3 syntax traded compiler complexity for programmer error surface.

---

## Overall Assessment

The v8→v9 port demonstrates a significant **expressiveness regression** in OpenEdgeDSL v3 for CGRA kernels that need:
1. **Parallel iteration** over PE grids (16-PE `for` loops)
2. **Row broadcast** patterns (per-column variation within a row)
3. **Declarative routing** (`#pragma route`)
4. **Selective NOP** visibility (`_` placeholders)

The v3 canonical syntax trades **conciseness and clarity** for **parser simplicity and regularity**. For this particular kernel, the cost is an 85% increase in source lines, 3 compiler workarounds, and 1 silently introduced bug that required several hours of debugging.

> [!IMPORTANT]
> The most impactful fix would be **BUG-7** (computed coordinates in `for` loops). Resolving this single issue would recover most of the lost expressiveness — `load_all`, `extract_bytes_col/row`, `compute_qhat_inregs`, and `mul_qhat_p_inregs` could all return to compact `for` loop form, eliminating ~100 lines of manual unrolling and the bug surface that comes with it.
