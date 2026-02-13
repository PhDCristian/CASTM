# `normalize(...)`

Lane normalization with carry extraction and directional relay.

## Syntax

```text
normalize(reg=R, carry=RC, width=W, lane=N[, mask=M, axis=row|col, dir=right|left|down|up]);
```

## Options

| Key | Required | Description |
|---|---|---|
| `reg` | yes | value register to normalize |
| `carry` | yes | temporary carry register |
| `width` | yes | carry width (`1..30`) |
| `lane` | yes | selected lane index |
| `mask` | no | normalization mask |
| `axis` | no | `row` (default) or `col` |
| `dir` | no | axis-compatible direction |

## Lowering Shape

Four deterministic cycles on selected lane:

1. `SRT carry, reg, width`
2. `LAND reg, reg, mask`
3. `SADD ROUT, carry, ZERO`
4. `SADD reg, reg, incoming`

`incoming` depends on `axis` + `dir` + lane position.

## Executable Example

```openedge
target "uma-cgra-base";
kernel "normalize_doc" {
  normalize(reg=R3, carry=R1, width=16, lane=0, axis=row, dir=right);
}
```

## Diagnostics

- invalid axis/direction combinations -> parse diagnostics
- out-of-range lanes -> coordinate diagnostics
