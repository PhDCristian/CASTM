# Program Structure

A canonical CASTM source has five top-level zones.

1. `target` declaration (required)
2. `build` block (optional)
3. `let` declarations (optional)
4. `function` definitions (optional)
5. one `kernel` block (required)

`target base;` is the canonical target entrypoint for users.

## Canonical Skeleton

```castm
target base;

build {
  optimize O2;
  scheduler balanced;
}

let MASK = 0xFFFF;
let acc = R1;
let input = { 10, 20, 30, 40 };
let matrix[2][2] = { 1, 2, 3, 4 };

function stage(src) {
  bundle { at @0,0: SADD R2, src, ZERO; }
}

kernel "structure" {
  stage(R0);
  bundle { at @0,1: NOP; }
}
```

## Kernel Items

Inside `kernel { ... }`, canonical items are:

- `config(...)`
- runtime statements (`io.load(...)`, `io.store(...)`, `limit(...)`, `assert(...)`)
- `bundle { ... }`
- `if/else`, `while`, `for`
- advanced statements (`std::route(...)`, `std::scan(...)`, `std::latency_hide(...)`, etc.)
- function calls and `pipeline(...)`

## Notes

- advanced statements preserve lexical placement in the kernel timeline.
- compilation stages expose structured artifacts for debugging and tooling.


## CASTM ↔ CSV

::: code-group
<<< ../snippets/language/program-structure/01-main.castm{castm} [CASTM]
<<< ../snippets/language/program-structure/01-main.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/language/program-structure/01-main.csv`.
