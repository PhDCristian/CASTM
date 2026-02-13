# OpenEdgeDSL Canonical Language Spec (Private)

OpenEdgeDSL canonical syntax is the only supported public language surface.  
Legacy declarations (`.const`, `.alias`, `.data`, `.data2d`) and legacy pragmas (`#pragma ...`) are not valid source syntax.

- Grammar: `docs/language/grammar.md`

## Core

- `let` unified declarations
- top-level `function` definitions + kernel call sites
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

kernel "canonical_example" {
  route(@0,1 -> @0,0, payload=R3, accum=R1);
  reduce(op=add, dest=R1, src=R0, axis=row);

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
- `route(...)` lowering preserves lexical position relative to neighboring cycles (no global hoisting).
- Inside `cycle { ... }`, semicolon-separated placements on the same line are supported.
- Computed spatial coordinates in loops (for example `@k/4,k%4`) are valid canonical syntax.
- Coordinate ranges are valid in canonical placements: `@r,c0..c1`, `@r0..r1,c`, and `@r0..r1,c0..c1` (inclusive expansion).
- Inline arithmetic in instruction operands is supported and folded when resolvable at compile time (for example `IMM((2+3)*4)` or `LWI R0, 360 + 2*4`).
- Canonical optimization includes specialization of algebraic identities (`SMUL * 1/0`, `SADD +0`, `SSUB -0`, `LAND/LOR/LXOR` with neutral constants, shifts by `0`).
