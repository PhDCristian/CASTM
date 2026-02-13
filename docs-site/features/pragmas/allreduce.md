# `std::allreduce(...)`

Grid-wide reduction followed by deterministic broadcast of reduced value.

## Syntax

```text
std::allreduce(op=add|sum|sub|and|or|xor|mul, dest=RD, src=RS[, axis=row|col]);
```

## Options

| Key | Required | Default | Description |
|---|---|---|---|
| `op` | yes | - | reduction combiner |
| `dest` | yes | - | destination register |
| `src` | yes | - | source register |
| `axis` | no | `row` | reduction/broadcast axis |

## Lowering Shape

1. Apply lane reduction (`std::reduce(...)`) on selected axis.
2. Broadcast reduced value from canonical source point over same axis scope.

## Executable Example

```openedge
target "uma-cgra-base";
kernel "allreduce_doc" {
  std::allreduce(op=add, dest=R1, src=R0, axis=row);
}
```

## DSL to CSV Example (Matrix)

```csv [CSV matrix excerpt]
0,,,
"SADD R1, R0, ZERO",NOP,NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
1,,,
NOP,"SADD ROUT, R0, ZERO",NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
2,,,
"SADD R3, RCR, ZERO",NOP,NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
3,,,
"SADD R1, R1, R3",NOP,NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
```

## Diagnostics

Invalid operations or malformed arguments emit explicit parse/semantic diagnostics.
