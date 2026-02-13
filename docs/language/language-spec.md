# OpenEdgeDSL Canonical Language Spec (Private)

OpenEdgeDSL canonical syntax is the only supported public language surface.  
Legacy declarations (`.const`, `.alias`, `.data`, `.data2d`) and legacy pragmas (`#pragma ...`) are not valid source syntax.

- Grammar: `docs/language/grammar.md`

## Core

- `let` unified declarations
- top-level `function` definitions + kernel call sites
- `pipeline(...)` function-call sequencing macro
- explicit spatial namespace (`at ...`)
- advanced statements (`route(...)`, `reduce(...)`, `scan(...)`, etc.)
- explicit runtime loop form
- runtime directives (`.io_load`, `.io_store`, `.limit`, `.assert`)

## Example (executable)

```dsl
target "uma-cgra-base";
let MASK = 0xFFFF;
let acc = R1;
let input = { 10, 20, 30, 40 };
let output @100 = { 0, 0, 0, 0 };
let matrix[2][2] = { 1, 2, 3, 4 };

function helper_stage_a() {
  cycle { @0,0: NOP; }
}

function helper_stage_b(src) {
  cycle { @0,1: SADD R2, src, ZERO; }
}

kernel "canonical_example" {
  route(@0,1 -> @0,0, payload=R3, accum=R1);
  accumulate(pattern=anti_diagonal, products=R2, accum=R3, out=ROUT, combine=add);
  carry_chain(src=R0, carry=R3, store=output, limbs=2, width=16, row=0);
  conditional_sub(value=R0, sub=R1, dest=R2, target=row(1));
  pipeline(helper_stage_a(), helper_stage_b(R0));
  collect(from=row(1), to=row(0), via=RCB, local=R2, into=R3, combine=add);
  normalize(reg=R3, carry=R1, width=16, lane=0, axis=row, dir=right);
  extract_bytes(src=R0, dest=R1, axis=col);
  reduce(op=add, dest=R1, src=R0, axis=row);
  guard(cond=col>=row, op=SMUL, dest=R2, srcA=R0, srcB=R1);
  triangle(shape=upper, inclusive=true, op=SMUL, dest=R2, srcA=R0, srcB=R1);

  for R0 in range(0, 2) at @0,0 runtime {
    cycle {
      at @0,0: R2 = input[R0];
      at @0,1: output[R0] = R2;
      at col 2: NOP;
    }
  }
}
```

## Notes

- Memory sugar in `cycle {}` lowers to existing ISA (`LWI/SWI`) without changing CSV format.
- Advanced statements lower to existing codegen passes.
- `accumulate(...)` provides deterministic NxM accumulation patterns (`row`, `col`, `anti_diagonal`) and removes manual ROUT-graph boilerplate from kernels.
- `carry_chain(...)` provides deterministic limb carry propagation + store staging without manual repeated cycles.
- `conditional_sub(...)` provides deterministic branchless subtraction/select (`SSUB` + `BSFA`) scoped to `all`, `row`, `col`, or one point target (`point(r,c)`).
- `pipeline(...)` expands ordered function-call sequences and keeps function-based composition explicit without introducing legacy macro engines.
- `collect(...)` provides aligned single-hop lane collection (`row/col`) with deterministic lowering and explicit geometry checks.
- `normalize(...)` provides canonical carry-normalization over one row/column lane using deterministic multi-cycle lowering (`SRT` + `LAND` + carry relay + lane add).
- `extract_bytes(...)` unifies row/column byte-lane extraction as a canonical two-cycle pattern (`SRT` + `LAND`) over the active grid.
- `triangle(...)` expands deterministically in row-major order over the active grid (`shape=upper|lower`, optional `inclusive=true|false`) and emits one canonical cycle with per-PE placements.
- `guard(...)` applies a compile-time predicate (`cond`) over `row`, `col`, `idx`, `rows`, `cols` and emits deterministic row-major placements for matching PEs only.
- `route(...)` lowering preserves lexical position relative to neighboring cycles (no global hoisting).
- Inside `cycle { ... }`, semicolon-separated placements on the same line are supported.
- Computed spatial coordinates in loops (for example `@k/4,k%4`) are valid canonical syntax.
- Coordinate ranges are valid in canonical placements: `@r,c0..c1`, `@r0..r1,c`, and `@r0..r1,c0..c1` (inclusive expansion).
- Row placements auto-broadcast when a single instruction is provided: `at row 1: INSTR;` expands to every column in row `1`.
- Inline arithmetic in instruction operands is supported and folded when resolvable at compile time (for example `IMM((2+3)*4)` or `LWI R0, 360 + 2*4`).
- Canonical optimization includes specialization of algebraic identities (`SMUL * 1/0`, `SADD +0`, `SSUB -0`, `LAND/LOR/LXOR` with neutral constants, shifts by `0`).
- Triangle spatial-pattern reference: `docs/language/triangle-statement.md`.
- Guard spatial-pattern reference: `docs/language/guard-statement.md`.
- Accumulation-pattern reference: `docs/language/accumulate-statement.md`.
- Carry-chain reference: `docs/language/carry-chain-statement.md`.
- Conditional-subtraction reference: `docs/language/conditional-sub-statement.md`.
- Pipeline-macro reference: `docs/language/pipeline-statement.md`.
- Collect lane-pattern reference: `docs/language/collect-statement.md`.
- Normalize lane-pattern reference: `docs/language/normalize-statement.md`.
- Byte-extraction reference: `docs/language/extract-bytes-statement.md`.
