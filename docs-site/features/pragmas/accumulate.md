# `accumulate(...)`

Deterministic NxM accumulation pattern over row, column, or anti-diagonal topology.

## Syntax

```text
accumulate(pattern=row|col|anti_diagonal, products=RS, accum=RA, out=RD[, combine=add|sum|sub|and|or|xor|mul]);
```

## Options

| Key | Required | Description |
|---|---|---|
| `pattern` | yes | accumulation topology (`row`, `col`, `anti_diagonal`) |
| `products` | yes | source per-PE value register |
| `accum` | yes | intermediate accumulation register |
| `out` | yes | final output register |
| `combine` | no | combiner opcode selector (default `add`) |

## Lowering Shape

1. Seed stage on every PE: `SADD accum, products, ZERO`
2. Pattern stage(s):
   - `row`: one lane pass using horizontal incoming
   - `col`: one lane pass using vertical incoming
   - `anti_diagonal`: two passes for anti-diagonal propagation
3. Final stage on every PE: `SADD out, accum, ZERO`

## Executable Example

```openedge
target "uma-cgra-base";
kernel "accumulate_doc" {
  accumulate(pattern=anti_diagonal, products=R2, accum=R3, out=ROUT, combine=add);
}
```

## CSV Excerpt

```csv
cycle,row,col,instruction
0,0,0,SADD R3 R2 ZERO
...,1,2,SADD R3 R3 RCT
...,0,2,SADD R3 R3 RCR
...,3,3,SADD ROUT R3 ZERO
```

## Diagnostics

- Invalid argument sets -> parse diagnostic.
- Unsupported combiner/pattern -> parse or semantic diagnostic with explicit hint.
