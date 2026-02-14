# Extract Bytes Statement (`std::extract_bytes(...)`)

`std::extract_bytes(...)` is a canonical advanced statement for byte-lane extraction over the full active grid.

## Canonical Syntax

```text
std::extract_bytes(src=R0, dest=R1[, axis=row|col, byteWidth=8, mask=255]);
```

Accepted values:

- `src`: source register.
- `dest`: destination register.
- `axis`: optional, defaults to `col`.
- `byteWidth`: optional, defaults to `8` (`1..16`).
- `mask`: optional, defaults to `(1 << byteWidth) - 1`.

## Semantics

Lowering is deterministic and emits 2 cycles over every PE:

1. `SRT dest, src, shift`
2. `LAND dest, dest, mask`

`shift` is computed from spatial coordinates:

- `axis=col`: `shift = col * byteWidth`
- `axis=row`: `shift = row * byteWidth`

This makes row/column extraction patterns explicit without duplicating near-identical helper functions.

## Examples

Default column-based extraction:

```text
std::extract_bytes(src=R0, dest=R1);
```

Row-based extraction with 4-bit nibbles:

```text
std::extract_bytes(src=R2, dest=R3, axis=row, byteWidth=4, mask=15);
```

## Executable Snippet

```dsl
target base;
kernel "extract_doc" {
  std::extract_bytes(src=R0, dest=R1, axis=col);
}
```

## Diagnostics

Malformed or unsupported forms are rejected with explicit diagnostics:

- parse diagnostics for invalid arguments (`axis`, missing `src/dest`, malformed numbers).
- parse diagnostics for unsupported `byteWidth`/`mask` values.

## Verification

Executable contract tests:

- `tests/issues/feat-11-extract-bytes.test.ts`
- `tests/compiler-api.collective-builders.test.ts`
- `tests/compiler-api.expand-pragmas.handlers.test.ts`
- `tests/compiler-api.passes-shared.test.ts`
