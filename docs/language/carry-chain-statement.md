# Carry Chain Statement (`std::carry_chain(...)`)

`std::carry_chain(...)` is a canonical advanced statement for deterministic limb-wise carry propagation with memory stores.

## Canonical Syntax

```text
std::carry_chain(src=R0, carry=R3, store=L, limbs=4, width=16, row=0[, mask=65535, start=0, dir=right|left]);
```

Accepted values:

- `src`: working limb register.
- `carry`: carry register reused between limbs.
- `store`: destination array symbol used as `store[index]`.
- `limbs`: number of limbs to process (`> 0`).
- `width`: carry extraction width (`1..30`).
- `row`: target row for the chain.
- `mask`: optional limb mask (defaults to `(1 << width) - 1`).
- `start`: optional start column (defaults to `0`).
- `dir`: optional direction (`right` default, `left` alternative).

## Semantics

For each limb, lowering emits a deterministic 4-cycle stage at the resolved `(row, col)`:

1. `SADD src, src, carry`
2. `LAND src, src, mask`
3. `SWI src, store[i]`
4. `SRT carry, src, width`

Total emitted cycles = `4 * limbs`.

## Examples

Rightward chain:

```text
std::carry_chain(src=R0, carry=R3, store=L, limbs=4, width=16, row=0);
```

Leftward chain with explicit mask:

```text
std::carry_chain(src=R4, carry=R5, store=L, limbs=2, width=8, mask=255, row=1, start=3, dir=left);
```

## Executable Snippet

```dsl
target base;
let L = { 0, 0, 0, 0 };
kernel "carry_chain_doc" {
  std::carry_chain(src=R0, carry=R3, store=L, limbs=3, width=16, row=0);
}
```

## Diagnostics

- parse diagnostics for malformed statements or invalid argument values.
- semantic coordinate diagnostics when row/column mapping exceeds grid bounds.

## Verification

Executable contract tests:

- `tests/issues/feat-02-carry-chain.test.ts`
- `tests/compiler-api.collective-builders.test.ts`
- `tests/compiler-api.expand-pragmas.handlers.test.ts`
- `tests/compiler-api.passes-shared.test.ts`
