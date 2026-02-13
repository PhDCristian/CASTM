# `carry_chain(...)`

Deterministic limb-wise carry propagation with staged memory stores.

## Syntax

```text
carry_chain(src=RS, carry=RC, store=ARRAY, limbs=N, width=W, row=R[, mask=M, start=C, dir=right|left]);
```

## Options

| Key | Required | Description |
|---|---|---|
| `src` | yes | working limb register |
| `carry` | yes | carry register |
| `store` | yes | target array symbol (`store[i]`) |
| `limbs` | yes | number of limbs (`> 0`) |
| `width` | yes | carry width (`1..30`) |
| `row` | yes | row used by chain |
| `mask` | no | limb mask (default `(1 << width) - 1`) |
| `start` | no | start column (default `0`) |
| `dir` | no | `right` (default) or `left` |

## Lowering Shape

Each limb emits a deterministic 4-cycle stage:

1. `SADD src, src, carry`
2. `LAND src, src, mask`
3. `SWI src, store[i]`
4. `SRT carry, src, width`

Total cycles: `4 * limbs`.

## Executable Example

```openedge
target "uma-cgra-base";
let L = { 0, 0, 0, 0 };

kernel "carry_chain_doc" {
  carry_chain(src=R0, carry=R3, store=L, limbs=3, width=16, row=0, start=0, dir=right);
}
```

## CSV Excerpt

```csv
cycle,row,col,instruction
0,0,0,SADD R0 R0 R3
1,0,0,LAND R0 R0 65535
2,0,0,SWI R0 L[0]
3,0,0,SRT R3 R0 16
```

## Diagnostics

- malformed argument lists -> parse diagnostics
- invalid direction/width/limb values -> parse diagnostics
- geometry overflow -> coordinate diagnostics
