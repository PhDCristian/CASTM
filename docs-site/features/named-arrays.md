# Unified Declarations (`let`)

Canonical CASTM uses `let` for constants, aliases, and arrays.

## Forms

- constant: `let MASK = 0xFFFF;`
- register alias: `let acc = R1;`
- 1D array: `let A = { 1, 2, 3 };`
- 1D fixed base: `let B @100 = { 4, 5, 6 };`
- 2D array: `let M[2][2] = { 1, 2, 3, 4 };`
- 2D zero-init: `let Z[4][4];`

## Executable Snippet

```castm
target base;
let MASK = 0xFFFF;
let acc = R1;
let A = { 1, 2, 3, 4 };
let M[2][2] = { 10, 20, 30, 40 };

kernel "decls" {
  bundle {
    at @0,0: R0 = A[2];
    at @0,1: R2 = M[1][0];
    at @0,2: LAND R3, R0, MASK;
  }
}
```


## CASTM ↔ CSV

::: code-group
<<< ../snippets/features/named-arrays/01-main.castm{castm} [CASTM]
<<< ../snippets/features/named-arrays/01-main.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/features/named-arrays/01-main.csv`.
