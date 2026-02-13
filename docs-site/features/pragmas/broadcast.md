# `broadcast(...)`

Spatial fan-out from a single source point across a row, column, or the full grid.

## Syntax

```text
broadcast(value=R0, from=@r,c, to=row|column|all);
```

## Options

| Key | Required | Description |
|---|---|---|
| `value` | yes | register value to broadcast |
| `from` | yes | source point |
| `to` | yes | destination scope |

## DSL to CSV Example

::: code-group
```openedge [OpenEdgeDSL]
target "uma-cgra-base";
kernel "broadcast_doc" {
  broadcast(value=R1, from=@0,0, to=row);
}
```

```csv [CSV (abridged)]
cycle,row,col,instruction
...,0,0,SADD ROUT R1 ZERO
...,0,1,SADD R1 R1 RCL
...,0,2,SADD R1 R1 RCL
```
:::
