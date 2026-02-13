# `std::mulacc_chain(...)`

Deterministic multiply-accumulate lane chain for row/column targets.

Use this statement when you need the repeated pattern:

1. multiply `src * coeff`,
2. accumulate with lane incoming (`RC*`) in a fixed direction,
3. mask/normalize by lane width.

## Syntax

```text
std::mulacc_chain(src=RS, coeff=RC, acc=RA, out=RO, target=row(i)|col(j)[, lanes=N][, width=16][, mask=65535][, dir=right|left|down|up]);
```

## Arguments

| Key | Required | Description |
|---|---|---|
| `src` | yes | source register (multiplier input) |
| `coeff` | yes | coefficient register |
| `acc` | yes | accumulation register used during propagation |
| `out` | yes | output register |
| `target` | yes | lane target (`row(i)` or `col(j)`) |
| `lanes` | no | number of active PEs in lane (default: full lane) |
| `width` | no | carry width in bits (default `16`) |
| `mask` | no | low-part mask (default `(1<<width)-1` for width<=31, else explicit value required) |
| `dir` | no | propagation direction (`right` for row, `down` for col by default) |

## Determinism Contract

- Lowering is deterministic row-major by lane coordinate.
- Same source + same options => same emitted CSV.
- Geometry is validated against grid bounds (`rows`, `cols`).

## Executable Example

```openedge
target "uma-cgra-base";

kernel "mulacc_chain_demo" {
  std::mulacc_chain(src=R0, coeff=R1, acc=R3, out=R2, target=row(0), lanes=4, width=16, mask=65535, dir=right);
}
```

## Representative CSV (flat)

```csv
cycle,row,col,instruction
0,0,0,SMUL R3 R0 R1
0,0,1,SMUL R3 R0 R1
0,0,2,SMUL R3 R0 R1
0,0,3,SMUL R3 R0 R1
1,0,1,SADD R3 R3 RCL
1,0,2,SADD R3 R3 RCL
1,0,3,SADD R3 R3 RCL
2,0,0,LAND R2 R3 65535
2,0,1,LAND R2 R3 65535
2,0,2,LAND R2 R3 65535
2,0,3,LAND R2 R3 65535
```

## Diagnostics

- target out of bounds -> semantic coordinate diagnostic.
- incompatible direction/target axis -> parse diagnostic.
- invalid `lanes` for target lane size -> semantic diagnostic.
