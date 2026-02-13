# `conditional_sub(...)`

Branchless conditional subtraction over configurable spatial targets.

## Syntax

```text
conditional_sub(value=RV, sub=RS, dest=RD[, target=all|row(N)|col(N)|point(r,c)]);
```

## Options

| Key | Required | Description |
|---|---|---|
| `value` | yes | candidate value register |
| `sub` | yes | subtraction register |
| `dest` | yes | destination register |
| `target` | no | spatial scope (`all` by default) |

## Lowering Shape

Always emits two deterministic stages over selected placements:

1. `SSUB dest, value, sub`
2. `BSFA dest, value, dest, SELF`

## Executable Example

```openedge
target "uma-cgra-base";
kernel "conditional_sub_doc" {
  conditional_sub(value=R0, sub=R1, dest=R2, target=row(1));
}
```

## CSV Excerpt

```csv
cycle,row,col,instruction
0,1,0,SSUB R2 R0 R1
...,1,0,BSFA R2 R0 R2 SELF
```

## Diagnostics

- malformed target syntax -> parse diagnostic
- out-of-range row/col/point -> coordinate diagnostic
