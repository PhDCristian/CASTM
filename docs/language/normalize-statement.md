# Normalize Statement (`std::normalize(...)`)

`std::normalize(...)` is a canonical advanced statement for limb-style carry normalization over a single row or column lane.

## Canonical Syntax

```text
std::normalize(reg=R3, carry=R1, width=16, lane=0[, mask=65535, axis=row|col, dir=right|left|down|up]);
```

Accepted values:

- `reg`: lane register to normalize.
- `carry`: temporary carry register.
- `width`: bit width used by right-shift extraction (`1..30`).
- `lane`: selected row/column index.
- `mask`: optional mask after normalization. If omitted, defaults to `(1 << width) - 1`.
- `axis`: optional, defaults to `row`.
- `dir`: optional, defaults to `right` for `axis=row` and `down` for `axis=col`.

Direction constraints:

- `axis=row` allows `dir=left|right`.
- `axis=col` allows `dir=up|down`.

## Semantics

Lowering is deterministic and emits 4 cycles over the selected lane:

1. `SRT carry, reg, width`
2. `LAND reg, reg, mask`
3. `SADD ROUT, carry, ZERO`
4. `SADD reg, reg, incoming`

`incoming` depends on `axis + dir` and lane position:

- row/right: `ZERO` at first element, otherwise `RCL`
- row/left: `ZERO` at last element, otherwise `RCR`
- col/down: `ZERO` at first element, otherwise `RCT`
- col/up: `ZERO` at last element, otherwise `RCB`

## Examples

Row normalization:

```text
std::normalize(reg=R3, carry=R1, width=16, lane=0);
```

Column normalization on NxM:

```text
std::normalize(reg=R2, carry=R0, width=8, mask=255, axis=col, lane=1, dir=up);
```

## Executable Snippet

```dsl
target base;
kernel "normalize_doc" {
  std::normalize(reg=R3, carry=R1, width=16, lane=0);
}
```

## Diagnostics

Malformed or unsupported forms are rejected with explicit diagnostics:

- parse diagnostics for invalid arguments (`axis/dir`, missing fields, malformed numbers).
- semantic diagnostics for out-of-bounds lanes.
- semantic diagnostics for unsupported width ranges.

## Verification

Executable contract tests:

- `tests/issues/feat-05-normalize.test.ts`
- `tests/compiler-api.collective-builders.test.ts`
- `tests/compiler-api.expand-pragmas.handlers.test.ts`
- `tests/compiler-api.passes-shared.test.ts`
