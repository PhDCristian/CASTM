# Triangle Statement (`std::triangle(...)`)

`std::triangle(...)` is a canonical advanced statement for generating deterministic upper/lower-triangle spatial patterns over the active grid.

## Canonical Syntax

```text
std::triangle(shape=upper|lower, inclusive=true|false, op=OPCODE, dest=RD, srcA=RA, srcB=RB);
```

Accepted values:

- `shape`: `upper` or `lower`.
- `inclusive`: optional, defaults to `true`. Also accepts `inclusive`/`exclusive` synonyms.
- `op`: any valid opcode identifier.
- `dest`, `srcA`, `srcB`: register-like operands (identifier tokens).

## Semantics

- The compiler expands the statement to one cycle containing concrete `@row,col` placements.
- Expansion is deterministic and row-major (`row` outer loop, `col` inner loop).
- Selection predicate:
  - `shape=upper, inclusive=true`: `col >= row`
  - `shape=upper, inclusive=false`: `col > row`
  - `shape=lower, inclusive=true`: `row >= col`
  - `shape=lower, inclusive=false`: `row > col`
- Expansion always uses the configured grid (`CompileOptions.grid`) so behavior is portable across NxM targets.

## Examples

Upper triangle (including diagonal):

```text
std::triangle(shape=upper, inclusive=true, op=SMUL, dest=R2, srcA=R0, srcB=R1);
```

Lower triangle (strictly below diagonal):

```text
std::triangle(shape=lower, inclusive=false, op=SADD, dest=R3, srcA=R1, srcB=R2);
```

## Executable Snippet

```dsl
target base;
kernel "triangle_doc" {
  std::triangle(shape=upper, inclusive=true, op=SMUL, dest=R2, srcA=R0, srcB=R1);
}
```

## Diagnostics

Malformed forms are rejected with parse diagnostics and a canonical hint. Example invalid forms:

- `std::triangle(shape=diag, op=SMUL, dest=R2, srcA=R0, srcB=R1);`
- `std::triangle(shape=upper, op=SMUL);`

## Verification

Executable contract tests:

- `tests/issues/feat-06-triangle.test.ts`
- `tests/compiler-api.expand-pragmas.handlers.test.ts`
- `tests/compiler-api.passes-shared.test.ts`
