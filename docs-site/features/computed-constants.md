# Computed Constants

Integer expressions are supported in canonical source where numeric expressions are expected.

## Supported Contexts

- `let` numeric values
- coordinate expressions (`@k/4,k%4`)
- immediate expressions (`(2+3)*4`)
- raw memory addresses (`[360 + i*4]`)

## Executable Snippet

```openedge
target base;
let BASE = 360;

kernel "computed" {
  for i in range(0, 4) {
    cycle {
      at @0,i: [BASE + i*4] = R1;
      at @1,i: R2 = [BASE + i*4];
    }
  }
}
```

Unresolved expressions that cannot be legally lowered produce diagnostics.


## OpenEdgeDSL ↔ CSV

::: code-group
<<< ../snippets/features/computed-constants/01-main.edsl{openedge} [OpenEdgeDSL]
<<< ../snippets/features/computed-constants/01-main.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/features/computed-constants/01-main.csv`.
