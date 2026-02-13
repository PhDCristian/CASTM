# `std::extract_bytes(...)`

Byte-lane extraction across the active grid with configurable axis and width.

## Syntax

```text
std::extract_bytes(src=RS, dest=RD[, axis=row|col, byteWidth=N, mask=M]);
```

## Options

| Key | Required | Default | Description |
|---|---|---|---|
| `src` | yes | - | source register |
| `dest` | yes | - | destination register |
| `axis` | no | `col` | shift axis |
| `byteWidth` | no | `8` | extraction width (`1..16`) |
| `mask` | no | `(1 << byteWidth) - 1` | lane mask |

## Lowering Shape

Two cycles over active placements:

1. `SRT dest, src, shift`
2. `LAND dest, dest, mask`

`shift` is derived from `row` or `col` and `byteWidth`.

## Executable Example

```openedge
target "uma-cgra-base";
kernel "extract_doc" {
  std::extract_bytes(src=R0, dest=R1, axis=col, byteWidth=8, mask=255);
}
```

## DSL to CSV Example (Matrix)

```csv [CSV matrix excerpt]
0,,,
"SRT R1, R0, 0","SRT R1, R0, 8","SRT R1, R0, 16","SRT R1, R0, 24"
"SRT R1, R0, 0","SRT R1, R0, 8","SRT R1, R0, 16","SRT R1, R0, 24"
"SRT R1, R0, 0","SRT R1, R0, 8","SRT R1, R0, 16","SRT R1, R0, 24"
"SRT R1, R0, 0","SRT R1, R0, 8","SRT R1, R0, 16","SRT R1, R0, 24"
1,,,
"LAND R1, R1, 255","LAND R1, R1, 255","LAND R1, R1, 255","LAND R1, R1, 255"
"LAND R1, R1, 255","LAND R1, R1, 255","LAND R1, R1, 255","LAND R1, R1, 255"
"LAND R1, R1, 255","LAND R1, R1, 255","LAND R1, R1, 255","LAND R1, R1, 255"
"LAND R1, R1, 255","LAND R1, R1, 255","LAND R1, R1, 255","LAND R1, R1, 255"
```

## Diagnostics

Invalid axis/width/mask forms produce explicit parse diagnostics.
