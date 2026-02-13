# `std::collect(...)`

Aligned single-hop lane collection for row or column lanes.

## Syntax

```text
std::collect(from=row(N)|col(N), to=row(M)|col(M), via=SELF|RCT|RCB|RCL|RCR, local=RL, into=RD[, combine=copy|add|sum|sub|and|or|xor|mul|shift_add]);
```

## Options

| Key | Required | Description |
|---|---|---|
| `from` | yes | source lane selector |
| `to` | no | destination lane selector (defaults to same axis lane 0) |
| `via` | yes | incoming neighbor used by destination lane |
| `local` | yes | local register at destination |
| `into` | yes | destination register |
| `combine` | no | combine mode (default `add`) |

## Semantics

- Supports same-lane and adjacent-lane transfers (`abs(from.index - to.index) <= 1`).
- `via` must match lane geometry.
- Emits deterministic row-major placement cycles.

## Executable Example

```openedge
target "uma-cgra-base";
kernel "collect_doc" {
  std::collect(from=row(1), to=row(0), via=RCB, local=R2, into=R3, combine=add);
}
```

## CSV Excerpt (Matrix)

```csv
0,,,
"SADD R3, RCB, ZERO","SADD R3, RCB, ZERO",NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
1,,,
"SADD R3, R2, R3","SADD R3, R2, R3",NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
NOP,NOP,NOP,NOP
```

## Diagnostics

- invalid axis/value combinations -> parse diagnostics
- invalid `via` for lane geometry -> semantic diagnostics
- out-of-range lanes -> coordinate diagnostics
