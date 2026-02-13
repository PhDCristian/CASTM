# `std::stencil(...)`

Neighborhood stencil expansion over canonical grid connectivity.

## Syntax

```text
std::stencil(pattern, src, dest);
std::stencil(pattern, op, src, dest);
```

## Options

| Argument | Description |
|---|---|
| `pattern` | `cross`, `horizontal`, `vertical` |
| `op` | optional combiner (`sum` default) |
| `src` | source register |
| `dest` | destination register |

## Executable Example

```openedge
target "uma-cgra-base";
kernel "stencil_doc" {
  std::stencil(cross, add, R0, R1);
}
```

## DSL to CSV Example (Matrix)

```csv [CSV matrix excerpt]
0,,,
"SADD R2, R0, RCT","SADD R2, R0, RCT","SADD R2, R0, RCT","SADD R2, R0, RCT"
"SADD R2, R0, RCT","SADD R2, R0, RCT","SADD R2, R0, RCT","SADD R2, R0, RCT"
"SADD R2, R0, RCT","SADD R2, R0, RCT","SADD R2, R0, RCT","SADD R2, R0, RCT"
"SADD R2, R0, RCT","SADD R2, R0, RCT","SADD R2, R0, RCT","SADD R2, R0, RCT"
1,,,
"SADD R2, R2, RCB","SADD R2, R2, RCB","SADD R2, R2, RCB","SADD R2, R2, RCB"
"SADD R2, R2, RCB","SADD R2, R2, RCB","SADD R2, R2, RCB","SADD R2, R2, RCB"
"SADD R2, R2, RCB","SADD R2, R2, RCB","SADD R2, R2, RCB","SADD R2, R2, RCB"
"SADD R2, R2, RCB","SADD R2, R2, RCB","SADD R2, R2, RCB","SADD R2, R2, RCB"
```

## Notes

Stencil lowering emits deterministic multi-cycle neighborhood combination patterns aligned with selected topology.
