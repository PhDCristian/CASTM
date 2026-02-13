# Coordinate Expressions

Canonical placements accept expressions and ranges in coordinates.

## Expression Coordinates

- `@0,i`
- `@k/4,k%4`

## Range Coordinates (inclusive)

- `@0,0..3`
- `@0..1,2`
- `@0..1,0..1`

## Executable Snippet

```openedge
target "uma-cgra-base";
kernel "coords" {
  cycle {
    @0,0..3: NOP;
    @1..2,1: NOP;
  }
}
```

Coordinate expressions that remain unresolved after loop expansion are rejected with semantic diagnostics.
