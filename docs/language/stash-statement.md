# Stash Statement (`std::stash(...)`)

`std::stash(...)` is a canonical advanced statement for explicit register spill/restore placement on the CGRA grid.

## Canonical Syntax

```text
std::stash(action=save|restore, reg=R0, addr=<memory-or-address>[, target=all|row(N)|col(N)|point(r,c)]);
```

Accepted values:

- `action`: `save` emits `SWI`, `restore` emits `LWI`.
- `reg`: register operand used by the emitted instruction.
- `addr`: memory operand (`L[0]`, `M[i][j]`) or raw address expression (`360`).
- `target`: optional spatial target (`all` by default).

## Semantics

Lowering emits one deterministic cycle with one placement per selected PE:

- `save`: `SWI reg, addr`
- `restore`: `LWI reg, addr`

Target expansion:

- `all`: every PE in the configured grid.
- `row(N)`: every column in row `N`.
- `col(N)`: every row in column `N`.
- `point(r,c)`: exactly one PE.

## Examples

Point-target save + restore:

```text
std::stash(action=save, reg=R0, addr=L[0], target=point(3,0));
std::stash(action=restore, reg=R1, addr=L[0], target=point(3,0));
```

Row/column/all targets:

```text
std::stash(action=save, reg=R2, addr=L[1], target=row(1));
std::stash(action=restore, reg=R3, addr=L[2], target=col(2));
std::stash(action=save, reg=R4, addr=360, target=all);
```

## Executable Snippet

```dsl
target base;
let L @360 = { 0, 0, 0, 0 };
kernel "stash_doc" {
  std::stash(action=save, reg=R0, addr=L[0], target=point(3,0));
  std::stash(action=restore, reg=R1, addr=L[0], target=point(3,0));
}
```

## Diagnostics

- parse diagnostics for malformed argument lists.
- semantic coordinate diagnostics when `row/col/point` are outside grid bounds.

## Verification

Executable contract tests:

- `tests/issues/feat-10-stash.test.ts`
- `tests/compiler-api.collective-builders.test.ts`
- `tests/compiler-api.expand-pragmas.handlers.test.ts`
- `tests/compiler-api.passes-shared.test.ts`
