# `std::route(...)`

Deterministic point-to-point transfer with optional custom combine operation.

## Syntax

```text
std::route(@r1,c1 -> @r2,c2, payload=Rx, accum=Ry);
std::route(@r1,c1 -> @r2,c2, payload=Rx, dest=Rd, op=OP(Rd, Ra, Rb));
```

## Options

| Key | Required | Description |
|---|---|---|
| `payload` | yes | register to inject into route path |
| `accum` | yes (simple form) | destination accumulation register |
| `dest` | yes (custom form) | destination register used by custom op |
| `op` | yes (custom form) | operation expression `OP(Rd, Ra, Rb)` |

## DSL to CSV Example (Matrix)

::: code-group
```openedge [OpenEdgeDSL]
target "uma-cgra-base";
kernel "route_doc" {
  std::route(@0,1 -> @0,0, payload=R3, accum=R1);
}
```

```csv [CSV matrix excerpt]
0,,,
NOP,"SADD ROUT, R3, ZERO",NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
1,,,
"SADD R1, R1, RCR",NOP,NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
```
:::

## Custom Operation Example

```openedge
target "uma-cgra-base";
kernel "route_custom_doc" {
  std::route(@1,0 -> @2,2, payload=R0, dest=R2, op=SMUL(R2, R1, INCOMING));
}
```

Generated route cycles preserve lexical position inside the kernel timeline.
