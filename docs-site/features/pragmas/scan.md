# `scan(...)`

Prefix scan statement with directional control and inclusive/exclusive mode.

## Syntax

```text
scan(op=add|sum|sub|and|or|xor|mul, src=RS, dest=RD, dir=left|right|up|down[, mode=inclusive|exclusive]);
```

## Options

| Key | Required | Default | Description |
|---|---|---|---|
| `op` | yes | - | scan combiner |
| `src` | yes | - | source register |
| `dest` | yes | - | destination register |
| `dir` | yes | - | scan direction |
| `mode` | no | `inclusive` | scan mode |

## DSL to CSV Example (Matrix)

::: code-group
```openedge [OpenEdgeDSL]
target "uma-cgra-base";
kernel "scan_doc" {
  scan(op=add, src=R0, dest=R2, dir=right, mode=exclusive);
}
```

```csv [CSV matrix excerpt]
0,,,
"SADD R2, ZERO, IMM(0)","SADD R2, R0, RCL",...,...
...,...,...,...
...,...,...,...
...,...,...,...
```
:::
