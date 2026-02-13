# Program Structure

A canonical OpenEdgeDSL source has four top-level zones.

1. `target` declaration (required)
2. `let` declarations (optional)
3. `function` definitions (optional)
4. one `kernel` block (required)

## Canonical Skeleton

```openedge
target "uma-cgra-base";

let MASK = 0xFFFF;
let acc = R1;
let input = { 10, 20, 30, 40 };
let matrix[2][2] = { 1, 2, 3, 4 };

function stage(src) {
  cycle { at @0,0: SADD R2, src, ZERO; }
}

kernel "structure" {
  stage(R0);
  cycle { at @0,1: NOP; }
}
```

## Kernel Items

Inside `kernel { ... }`, canonical items are:

- `config(...)`
- runtime directives (`.io_load`, `.io_store`, `.limit`, `.assert`)
- `cycle { ... }`
- `if/else`, `while`, `for`
- advanced statements (`std::route(...)`, `std::scan(...)`, `std::latency_hide(...)`, etc.)
- function calls and `pipeline(...)`

## Notes

- advanced statements preserve lexical placement in the kernel timeline.
- compilation stages expose structured artifacts for debugging and tooling.
