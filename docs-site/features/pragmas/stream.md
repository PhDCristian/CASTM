# `stream_load(...)` and `stream_store(...)`

Stream-pointer memory operations lowered to `LWD`/`SWD` over selected rows.

## Syntax

```text
stream_load(dest=RD[, row=N][, count=N]);
stream_store(src=RS[, row=N][, count=N]);
```

## Options

| Key | Required | Default | Description |
|---|---|---|---|
| `dest` / `src` | yes | - | destination or source register |
| `row` | no | `0` | row where streaming op is placed |
| `count` | no | `1` | number of emitted stream operations |

## DSL to CSV Example

::: code-group
```openedge [OpenEdgeDSL]
target "uma-cgra-base";
kernel "stream_doc" {
  stream_load(dest=R0, row=0, count=2);
  stream_store(src=R0, row=0, count=2);
}
```

```csv [CSV (abridged)]
cycle,row,col,instruction
0,0,0,LWD R0
1,0,0,LWD R0
2,0,0,SWD R0
3,0,0,SWD R0
```
:::
