# `reduce(...)`

Lane-wise reduction over row or column axis.

## Syntax

```text
reduce(op=add|sum|sub|and|or|xor|mul, dest=RD, src=RS[, axis=row|col]);
```

## Options

| Key | Required | Default | Description |
|---|---|---|---|
| `op` | yes | - | reduction combiner |
| `dest` | yes | - | destination register |
| `src` | yes | - | source register |
| `axis` | no | `row` | reduction orientation |

## DSL to CSV Example (Matrix)

::: code-group
```openedge [OpenEdgeDSL]
target "uma-cgra-base";
kernel "reduce_doc" {
  reduce(op=add, dest=R1, src=R0, axis=row);
}
```

```csv [CSV matrix excerpt]
0,,,
"SADD R1, R0, ZERO","SADD R1, R0, ZERO",...,...
...,...,...,...
...,...,...,...
...,...,...,...
1,,,
"SADD R1, R1, RCL","SADD R1, R1, RCL",...,...
...,...,...,...
...,...,...,...
...,...,...,...
```
:::
