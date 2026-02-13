# Computed Constants

Integer expressions are supported in canonical source where numeric expressions are expected.

## Supported Contexts

- `let` numeric values
- coordinate expressions (`@k/4,k%4`)
- immediate expressions (`IMM((2+3)*4)`)
- raw memory addresses (`[360 + i*4]`)

## Executable Snippet

```openedge
target "uma-cgra-base";
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
