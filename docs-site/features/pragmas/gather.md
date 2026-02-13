# `std::gather(...)`

Gather values from all source points to one destination point with selectable combiner.

## Syntax

```text
std::gather(src=RS, dest=@r,c, destReg=RD, op=add|sum|sub|and|or|xor|mul);
```

## Options

| Key | Required | Description |
|---|---|---|
| `src` | yes | source register sampled at each point |
| `dest` | yes | destination point |
| `destReg` | yes | accumulation register at destination |
| `op` | yes | combine operation |

## Semantics

- destination is initialized with local source value
- remaining points are transferred by route cycles
- destination combines incoming relay values using selected operation

## Executable Example

```openedge
target "uma-cgra-base";
kernel "gather_doc" {
  std::gather(src=R0, dest=@0,0, destReg=R1, op=add);
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

- out-of-grid destination -> coordinate diagnostics
- unsupported op -> semantic diagnostics
