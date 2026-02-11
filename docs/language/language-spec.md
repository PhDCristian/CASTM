# OpenEdgeDSL Canonical Language Spec (Private)

OpenEdgeDSL canonical syntax is the only supported public language surface.  
Legacy declarations (`.const`, `.alias`, `.data`, `.data2d`) and legacy pragmas (`#pragma ...`) are not valid source syntax.

- Grammar: `docs/language/grammar.md`
- Migration map: `docs/language/migration-map.md`

## Core

- `let` unified declarations
- explicit spatial namespace (`at ...`)
- advanced statements (`route(...)`, `reduce(...)`, `scan(...)`, etc.)
- explicit runtime loop form

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
