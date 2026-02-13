# `stencil(...)`

Neighborhood stencil expansion over canonical grid connectivity.

## Syntax

```text
stencil(pattern, src, dest);
stencil(pattern, op, src, dest);
```

## Options

| Argument | Description |
|---|---|
| `pattern` | `cross`, `horizontal`, `vertical` |
| `op` | optional combiner (`sum` default) |
| `src` | source register |
| `dest` | destination register |

## Executable Example

```openedge
target "uma-cgra-base";
kernel "stencil_doc" {
  stencil(cross, add, R0, R1);
}
```

## Notes

Stencil lowering emits deterministic multi-cycle neighborhood combination patterns aligned with selected topology.
