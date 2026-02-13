# Memory Sugar

Canonical memory sugar is available inside `cycle {}` and lowers to existing `LWI/SWI` ISA forms.

## Supported Forms

- `R3 = A[i];`
- `A[i] = R3;`
- `R3 = [addrExpr];`
- `[addrExpr] = R3;`

## Behavioral Rules

| Rule | Description |
|---|---|
| Load destination | must be a register |
| Store source | must be a register |
| Memory-to-memory | not allowed |
| Addressing | supports 1D, 2D, and raw-address expressions |

## DSL to CSV Example

::: code-group
```openedge [OpenEdgeDSL]
target "uma-cgra-base";
let A = { 10, 20, 30, 40 };
let B @100 = { 0, 0, 0, 0 };

kernel "mem_sugar" {
  cycle {
    at @0,0: R0 = A[1];
    at @0,1: B[2] = R0;
    at @0,2: [360 + 2*4] = R1;
    at @0,3: R2 = [360 + 2*4];
  }
}
```

```csv [CSV (abridged)]
cycle,row,col,instruction
0,0,0,LWI R0 4
0,0,1,SWI R0 108
0,0,2,SWI R1 360 + 2*4
0,0,3,LWI R2 360 + 2*4
```
:::
