# `transpose(...)`

In-place matrix transpose lowering for square grids.

## Syntax

```text
transpose(reg=R0);
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
  transpose(reg=R0);
}
```

## Diagnostics

- non-square grids -> unsupported operation diagnostics
- missing scratch registers -> unsupported operation diagnostics
