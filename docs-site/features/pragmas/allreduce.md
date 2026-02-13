# `allreduce(...)`

Grid-wide reduction followed by deterministic broadcast of reduced value.

## Syntax

```text
allreduce(op=add|sum|sub|and|or|xor|mul, dest=RD, src=RS[, axis=row|col]);
```

## Options

| Key | Required | Default | Description |
|---|---|---|---|
| `op` | yes | - | reduction combiner |
| `dest` | yes | - | destination register |
| `src` | yes | - | source register |
| `axis` | no | `row` | reduction/broadcast axis |

## Lowering Shape

1. Apply lane reduction (`reduce(...)`) on selected axis.
2. Broadcast reduced value from canonical source point over same axis scope.

## Executable Example

```openedge
target "uma-cgra-base";
kernel "allreduce_doc" {
  allreduce(op=add, dest=R1, src=R0, axis=row);
}
```

## Diagnostics

Invalid operations or malformed arguments emit explicit parse/semantic diagnostics.
