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

## DSL to CSV Example (Matrix)

::: code-group
```openedge [OpenEdgeDSL]
target "uma-cgra-base";
kernel "stream_doc" {
  stream_load(dest=R0, row=0, count=2);
  stream_store(src=R0, row=0, count=2);
}
```

```csv [CSV matrix excerpt]
0,,,
"LWD R0",NOP,NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
1,,,
"LWD R0",NOP,NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
2,,,
"SWD R0",NOP,NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
3,,,
"SWD R0",NOP,NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
```
:::
