# Dynamic Coordinates in Loops

Computed coordinates are valid canonical syntax when values resolve through loop bindings.

## Example

```openedge
target "uma-cgra-base";
kernel "dynamic_coords" {
  for k in range(0, 16) {
    cycle {
      @k/4,k%4: NOP;
    }
  }
}
```

## Validation

- inside compile-time loops: allowed when expression resolves to integer coordinates.
- unresolved coordinate expressions outside valid binding context are rejected.
