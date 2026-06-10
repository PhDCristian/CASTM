# Spatial-Temporal Model

CASTM maps source operations to space (`row,col`) and time (`bundle index`).

## Spatial Placement

Canonical forms inside `bundle`:

- `at @r,c: INSTR;`
- `@r,c: INSTR;` (short canonical point form)
- `at row N: INSTR;`
- `at col N: INSTR;`
- `at all: INSTR;`

Coordinate expressions and ranges are supported:

- computed coordinates in loops: `@k/4,k%4`
- inclusive ranges: `@0,0..3`, `@0..1,2`, `@0..1,0..1`

## Temporal Ordering

- Each `bundle { ... }` contributes one or more placements at a bundle index.
- Advanced statements can emit multiple generated bundles.
- `std::latency_hide(...)` may compact adjacent bundles conservatively when hazards are absent.

## Executable Snippet

```castm
target base;
kernel "space_time" {
  for k in range(0, 16) {
    bundle { @k/4,k%4: NOP; }
  }
  bundle { @0,0: R0 = R0 + 1; @0,1: R1 = R1 + 1; }
}
```


## CASTM ↔ CSV

::: code-group
<<< ../snippets/language/spatial-temporal/01-main.castm{castm} [CASTM]
<<< ../snippets/language/spatial-temporal/01-main.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/language/spatial-temporal/01-main.csv`.
