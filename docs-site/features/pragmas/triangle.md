# `triangle(...)`

Deterministic upper/lower triangle spatial pattern generation.

## Syntax

```text
triangle(shape=upper|lower, inclusive=true|false, op=OPCODE, dest=RD, srcA=RA, srcB=RB);
```

## Options

| Key | Required | Description |
|---|---|---|
| `shape` | yes | `upper` or `lower` |
| `inclusive` | no | include diagonal (default `true`) |
| `op` | yes | opcode |
| `dest`, `srcA`, `srcB` | yes | instruction operands |

## Semantics

One cycle is emitted with placements selected by shape predicate:

- upper inclusive: `col >= row`
- upper exclusive: `col > row`
- lower inclusive: `row >= col`
- lower exclusive: `row > col`

Evaluation order is deterministic row-major.

## Executable Example

```openedge
target "uma-cgra-base";
kernel "triangle_doc" {
  triangle(shape=upper, inclusive=true, op=SMUL, dest=R2, srcA=R0, srcB=R1);
}
```
