# 2D Arrays

2D arrays are declared canonically with `let name[rows][cols]`.

## Forms

- initialized: `let M[2][2] = { 1, 2, 3, 4 };`
- zero-init: `let Z[4][4];`

## Addressing

Inside cycles you can use indexed access:

- `R0 = M[i][j];`
- `M[i][j] = R0;`

These lower to `LWI/SWI` with resolved linear addresses.

## Executable Snippet

```castm
target base;
let M[2][2] = { 10, 20, 30, 40 };

kernel "array2d" {
  bundle {
    at @0,0: R0 = M[1][1];
    at @0,1: M[0][1] = R0;
  }
}
```


## CASTM ↔ CSV

::: code-group
<<< ../snippets/features/2d-arrays/01-main.castm{castm} [CASTM]
<<< ../snippets/features/2d-arrays/01-main.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/features/2d-arrays/01-main.csv`.
