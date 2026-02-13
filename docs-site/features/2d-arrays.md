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

```openedge
target "uma-cgra-base";
let M[2][2] = { 10, 20, 30, 40 };

kernel "array2d" {
  cycle {
    at @0,0: R0 = M[1][1];
    at @0,1: M[0][1] = R0;
  }
}
```
