# Collect Statement (`std::collect(...)`)

`std::collect(...)` is a canonical advanced statement for aligned lane collection across rows or columns.

## Canonical Syntax

```text
std::collect(from=row(N)|col(N), to=row(M)|col(M), via=SELF|RCT|RCB|RCL|RCR, local=RL, into=RD[, combine=copy|add|sum|sub|and|or|xor|mul|shift_add][, path=single_hop|multi_hop][, max_hops=K]);
```

Accepted values:

- `from`: source lane selector (`row(N)` or `col(N)`).
- `to`: destination lane selector (`row(M)` or `col(M)`), optional. Defaults to the same axis at index `0`.
- `via`: incoming neighbor register used by destination PEs (`SELF`, `RCT`, `RCB`, `RCL`, `RCR`).
- `local`: local register operand at the destination lane.
- `into`: destination register where collected results are stored.
- `combine`: optional, defaults to `add`.
- `path`: optional, defaults to `single_hop`.
- `max_hops`: optional, valid with `path=multi_hop`, caps allowed hop distance.

## Semantics

- The statement lowers into deterministic row-major multi-placement cycles.
- `path=single_hop` supports only same-lane or adjacent-lane transfers (`abs(from.index - to.index) <= 1`).
- `path=multi_hop` emits one deterministic copy cycle per hop toward the destination lane, then applies the optional combine stage.
- `via` must match the geometric direction implied by `from -> to`:
  - row: `from=to-1 => RCT`, `from=to+1 => RCB`, `from=to => SELF`
  - col: `from=to-1 => RCL`, `from=to+1 => RCR`, `from=to => SELF`
- Lowering shape:
  - Cycle A (copy): `SADD into, via, ZERO` at each destination lane point.
  - Cycle B (combine), when `combine != copy`:
    - `add/sum/sub/and/or/xor/mul`: `OP into, local, into`
    - `shift_add`: first lane uses `ZERO`, remaining lanes use lane incoming (`RCL` for rows, `RCT` for cols).

## Examples

Row collection from row `1` into row `0`:

```text
std::collect(from=row(1), to=row(0), via=RCB, local=R2, into=R3, combine=add);
```

Column collection in NxM:

```text
std::collect(from=col(2), to=col(1), via=RCR, local=R4, into=R5, combine=xor);
```

Multi-hop row collection:

```text
std::collect(from=row(0), to=row(2), via=RCT, local=R2, into=R3, combine=add, path=multi_hop, max_hops=2);
```

## Executable Snippet

```dsl
target base;
kernel "collect_doc" {
  std::collect(from=row(1), to=row(0), via=RCB, local=R2, into=R3, combine=add);
}
```

## Diagnostics

Malformed or unsupported forms are rejected with explicit diagnostics:

- parse diagnostic for invalid argument shapes.
- semantic diagnostic for out-of-bounds lane indices.
- semantic diagnostic when `via` does not match `from/to` geometry.
- semantic diagnostic for invalid path/hop constraints (`E3013`).

## Verification

Executable contract tests:

- `tests/issues/feat-12-collect.test.ts`
- `tests/compiler-api.collective-builders.test.ts`
- `tests/compiler-api.expand-pragmas.handlers.test.ts`
- `tests/compiler-api.passes-shared.test.ts`
