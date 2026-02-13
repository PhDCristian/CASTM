# `std::accumulate(...)`

Deterministic NxM accumulation pattern over row, column, or anti-diagonal topology.

## Syntax

```text
std::accumulate(pattern=row|col|anti_diagonal, products=RS, accum=RA, out=RD[, combine=add|sum|sub|and|or|xor|mul][, steps=<int>=1][, scope=all|row(i)|col(j)]);
```

## Options

| Key | Required | Description |
|---|---|---|
| `pattern` | yes | accumulation topology (`row`, `col`, `anti_diagonal`) |
| `products` | yes | source per-PE value register |
| `accum` | yes | intermediate accumulation register |
| `out` | yes | final output register |
| `combine` | no | combiner opcode selector (default `add`) |
| `steps` | no | propagation passes per pattern stage (default `1`) |
| `scope` | no | spatial subset (`all` default, or `row(i)` / `col(j)`) |

## Lowering Shape

1. Seed stage on every PE: `SADD accum, products, ZERO`
2. Pattern stage(s), repeated `steps` times:
   - `row`: one lane pass using horizontal incoming
   - `col`: one lane pass using vertical incoming
   - `anti_diagonal`: two passes for anti-diagonal propagation
3. Final stage on every PE: `SADD out, accum, ZERO`

Deterministic lowering optimization:

- Seed stage is omitted when `products == accum`.
- Final stage is omitted when `accum == out`.

Grid-aware `steps` limits:

- `row`: `steps <= cols - 1`
- `col`: `steps <= rows - 1`
- `anti_diagonal`: `steps <= max(rows - 1, cols - 1)`

Scope compatibility:

- `scope=all`: `row`, `col`, and `anti_diagonal`.
- `scope=row(i)`: only `pattern=row`.
- `scope=col(j)`: only `pattern=col`.

## Executable Example

```openedge
target "uma-cgra-base";
kernel "accumulate_doc" {
  std::accumulate(pattern=anti_diagonal, products=R2, accum=R3, out=ROUT, combine=add, steps=2);
  std::accumulate(pattern=row, products=R2, accum=R3, out=ROUT, scope=row(1));
}
```

## CSV Excerpt (Matrix)

```csv
0,,,
"SADD R3, R2, ZERO","SADD R3, R2, ZERO",NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
1,,,
NOP,"SADD R3, R3, RCT",NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
2,,,
NOP,"SADD R3, R3, RCR",NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
3,,,
"SADD ROUT, R3, ZERO","SADD ROUT, R3, ZERO",NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
```

## Diagnostics

- Invalid argument sets -> parse diagnostic.
- Unsupported combiner/pattern -> parse or semantic diagnostic with explicit hint.
- Step limits that exceed grid/pattern capacity -> semantic diagnostic with explicit limit hint.
