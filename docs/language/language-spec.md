# CASTM Canonical Language Spec (Private)

CASTM canonical syntax is the only supported public language surface.  
Legacy declarations (`.const`, `.alias`, `.data`, `.data2d`) and legacy pragmas (`#pragma ...`) are not valid source syntax.

- Grammar: `docs/language/grammar.md`

## Core

- `let` unified declarations
- top-level `function` definitions + kernel call sites
- `pipeline(...)` function-call sequencing macro
- explicit spatial namespace (`at ...`)
- standard advanced statements (`std::route(...)`, `std::reduce(...)`, `std::scan(...)`, etc.)
- conservative cycle compaction statement (`std::latency_hide(...)`)
- explicit stash statement (`std::stash(...)`) for deterministic register spill/restore placement
- explicit runtime loop form
- static loop strategy modifiers in headers: `unroll(k)` and `collapse(n)`
- loop-control statements: `break;`, `continue;`, `break label;`, `continue label;`
- labels on compound statements: `label: cycle|for|if|while|std::...|fnCall(...)`
- runtime statements (`io.load(...)`, `io.store(...)`, `limit(...)`, `assert(...)`)
- source-owned build configuration (`build { optimize/scheduler/... }`)

## Example (executable)

```dsl
target base;
build {
  optimize O2;
  scheduler balanced;
  scheduler_window auto;
  memory_reorder same_address_fence;
  prune_noop_cycles on;
  grid 4x4 torus;
}
let MASK = 0xFFFF;
let acc = R1;
let input = { 10, 20, 30, 40 };
let output @100 = { 0, 0, 0, 0 };
let matrix[2][2] = { 1, 2, 3, 4 };

function helper_stage_a() {
  bundle { @0,0: NOP; }
}

function helper_stage_b(src) {
  bundle { @0,1: SADD R2, src, ZERO; }
}

kernel "canonical_example" {
  io.load(0, 4, 8);
  io.store(16, 20);
  limit(256);
  assert(at=@0,0, reg=R0, equals=0, cycle=0);

  std::latency_hide(window=1, mode=conservative);
  std::stash(action=save, reg=R0, addr=output[0], target=point(3,0));
  std::route(@0,1 -> @0,0, payload=R3, accum=R1);
  std::accumulate(pattern=anti_diagonal, products=R2, accum=R3, out=ROUT, combine=add);
  std::carry_chain(src=R0, carry=R3, store=output, limbs=2, width=16, row=0);
  std::conditional_sub(value=R0, sub=R1, dest=R2, target=row(1));
  pipeline(helper_stage_a(), helper_stage_b(R0));
  std::collect(from=row(1), to=row(0), via=RCB, local=R2, into=R3, combine=add);
  std::normalize(reg=R3, carry=R1, width=16, lane=0, axis=row, dir=right);
  std::extract_bytes(src=R0, dest=R1, axis=col);
  std::reduce(op=add, dest=R1, src=R0, axis=row);
  std::guard(cond=col>=row, op=SMUL, dest=R2, srcA=R0, srcB=R1);
  std::triangle(shape=upper, inclusive=true, op=SMUL, dest=R2, srcA=R0, srcB=R1);

  for i in range(0, 2) unroll(2) collapse(2) {
    for j in range(0, 2) {
      bundle {
        at @i,j: NOP;
      }
    }
  }

  for R0 in range(0, 2) at @0,0 runtime {
    bundle {
      at @0,0: R2 = input[R0];
      at @0,1: output[R0] = R2;
      at col 2: NOP;
    }
  }
}
```

## Notes

- Memory sugar in `bundle {}` lowers to existing ISA (`LWI/SWI`) without changing CSV format.
- `std::` advanced statements lower to existing codegen passes. Unqualified forms are temporary compatibility syntax and emit migration warnings.
- `std::accumulate(...)` provides deterministic NxM accumulation patterns (`row`, `col`, `anti_diagonal`) with optional `steps=N` propagation depth and optional `scope=all|row(i)|col(j)` sub-grid targeting, removing manual ROUT-graph boilerplate from kernels.
- `std::mulacc_chain(...)` provides deterministic lane-local multiply-accumulate propagation (`row(i)`/`col(j)`) with explicit `width`, `mask`, `lanes`, and direction (`dir`).
- `std::accumulate(...)` omits redundant seed/final stages when `products == accum` and/or `accum == out` to reduce cycles without changing semantics.
- `std::carry_chain(...)` provides deterministic limb carry propagation + store staging without manual repeated cycles.
- `std::conditional_sub(...)` provides deterministic branchless subtraction/select (`SSUB` + `BSFA`) scoped to `all`, `row`, `col`, or one point target (`point(r,c)`).
- `pipeline(...)` expands ordered function-call sequences and keeps function-based composition explicit without introducing legacy macro engines.
- `std::collect(...)` provides deterministic lane collection (`row/col`) with explicit path modes: `single_hop` (adjacent/same-lane) and `multi_hop` (bounded hop chain via `max_hops`).
- `std::normalize(...)` provides canonical carry-normalization over one row/column lane using deterministic multi-cycle lowering (`SRT` + `LAND` + carry relay + lane add).
- `std::extract_bytes(...)` unifies row/column byte-lane extraction as a canonical two-cycle pattern (`SRT` + `LAND`) over the active grid.
- `std::triangle(...)` expands deterministically in row-major order over the active grid (`shape=upper|lower`, optional `inclusive=true|false`) and emits one canonical cycle with per-PE placements.
- `std::guard(...)` applies a compile-time predicate (`cond`) over `row`, `col`, `idx`, `rows`, `cols` and emits deterministic row-major placements for matching PEs only.
- `std::route(...)` lowering preserves lexical position relative to neighboring cycles (no global hoisting).
- Static `for` modifiers are deterministic:
  - `unroll(k)` controls static expansion chunking.
  - `collapse(n)` currently requires perfectly nested static loops and applies row-major mapping.
- `std::latency_hide(...)` applies deterministic post-expansion slot packing with explicit hazard guards (PE overlap, route-hop dependencies, control barriers, memory policy fences), can overlap disjoint route steps safely, and remaps numeric branch targets when noop cycles are removed.
- Build configuration is source-owned and deterministic:
  - `optimize` preset: `O0`, `O1`, `O2`, `O3`.
  - optional overrides in `build {}`: `scheduler`, `scheduler_window`, `memory_reorder`, `prune_noop_cycles`, `grid`.
  - explicit `build` keys override `optimize` defaults.
- `std::stash(...)` provides deterministic explicit spill/restore lowering to `SWI/LWI` for selected spatial targets (`all`, `row`, `col`, `point`).
- Inside `bundle { ... }`, semicolon-separated placements on the same line are supported.
- Inside `bundle { ... }`, short point form `@r,c:` is canonical and equivalent to `at @r,c:`.
- Computed spatial coordinates in loops (for example `@k/4,k%4`) are valid canonical syntax.
- Coordinate ranges are valid in canonical placements: `@r,c0..c1`, `@r0..r1,c`, and `@r0..r1,c0..c1` (inclusive expansion).
- Row placements auto-broadcast when a single instruction is provided: `at row 1: INSTR;` expands to every column in row `1`.
- Segmented row payload is canonical: `at row N: instr0 | instr1 | ...`.
- `row N: ...` without `at` is intentionally unsupported and yields parse diagnostic `E2002`.
- Inline arithmetic in instruction operands is supported and folded when resolvable at compile time (for example `(2+3)*4` or `LWI R0, 360 + 2*4`).
- Canonical optimization includes specialization of algebraic identities (`SMUL * 1/0`, `SADD +0`, `SSUB -0`, `LAND/LOR/LXOR` with neutral constants, shifts by `0`).
- Triangle spatial-pattern reference: `docs/language/triangle-statement.md`.
- Guard spatial-pattern reference: `docs/language/guard-statement.md`.
- Accumulation-pattern reference: `docs/language/accumulate-statement.md`.
- Carry-chain reference: `docs/language/carry-chain-statement.md`.
- Conditional-subtraction reference: `docs/language/conditional-sub-statement.md`.
- Pipeline-macro reference: `docs/language/pipeline-statement.md`.
- Latency-hide scheduler reference: `docs/language/latency-hide-statement.md`.
- Stash statement reference: `docs/language/stash-statement.md`.
- Collect lane-pattern reference: `docs/language/collect-statement.md`.
- Normalize lane-pattern reference: `docs/language/normalize-statement.md`.
- Byte-extraction reference: `docs/language/extract-bytes-statement.md`.
