# `std::transpose(...)`

In-place matrix transpose lowering for square grids.

## Syntax

```text
std::transpose(reg=R0);
```

## Semantics

For each off-diagonal pair `(i,j) <-> (j,i)`:

1. route `reg` from A to B into scratch A
2. route `reg` from B to A into scratch B
3. swap-write both points in one cycle

Requires a square grid and available scratch registers.

## Executable Example

```openedge
target "uma-cgra-base";
kernel "transpose_doc" {
  std::transpose(reg=R0);
}
```

## DSL to CSV Example (Matrix)

```csv [CSV matrix excerpt]
0,,,
NOP,"SADD ROUT, R0, ZERO",NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
1,,,
"SADD ROUT, RCR, ZERO",NOP,NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
2,,,
NOP,NOP,NOP,NOP
"SADD R3, RCT, ZERO",NOP,NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
3,,,
NOP,NOP,NOP,NOP
"SADD ROUT, R0, ZERO",NOP,NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
```

## Diagnostics

- non-square grids -> unsupported operation diagnostics
- missing scratch registers -> unsupported operation diagnostics
