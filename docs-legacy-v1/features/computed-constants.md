# Computed Constants

The `.const` directive supports arithmetic expressions, allowing you to define constants relative to other constants.

## Syntax

```c
.const NAME VALUE
.const NAME EXPRESSION
```

## Examples

### Basic Constants
```c
.const BASE 400
.const COUNT 16
```

### Computed Constants

<!-- expect: LWI R0, 404 -->
```c
.const BASE 400
.const NEXT BASE + 4       // 404
.const BLOCK_SIZE 80
.const U_BASE BASE + BLOCK_SIZE  // 480

kernel "ComputedConstExample" {
    config(0xF, 0);
    cycle { @0,0: LWI R0, NEXT; }  // Loads from 404
    cycle { @0,0: EXIT; }
}
```

### Supported Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `+` | Addition | `BASE + 4` |
| `-` | Subtraction | `END - 1` |
| `*` | Multiplication | `STRIDE * 4` |
| `/` | Division (integer) | `SIZE / 2` |
| `%` | Modulo | `INDEX % 4` |

### Operator Precedence

Follows standard arithmetic precedence:
1. `*`, `/`, `%` (highest)
2. `+`, `-` (lowest)

```c
.const A 10
.const B 3
.const C A + B * 2    // = 10 + (3 * 2) = 16
.const D A - B + 2    // = (10 - 3) + 2 = 9
```

## Use Cases

### Memory Layout Definition

```c
// Define memory regions relative to a base
.const DATA_BASE 0
.const X_ADDR DATA_BASE          // 0
.const P_ADDR DATA_BASE + 4      // 4
.const K_ADDR DATA_BASE + 8      // 8

// Product storage (16 values)
.const P_BASE 800
.const P_SIZE 64                 // 16 * 4 bytes
.const Q_BASE P_BASE + P_SIZE    // 864
```

### Coefficient Indexing

```c
.const C_BASE 300
.const C0 C_BASE           // 300
.const C1 C_BASE + 4       // 304
.const C2 C_BASE + 8       // 308

kernel "CoefficientLoad" {
    config(0xF, 0);
    cycle {
        @0,0: LWI R0, C0;
        @0,1: LWI R0, C1;
        @0,2: LWI R0, C2;
    }
    cycle { @0,0: EXIT; }
}
```

## Limitations

1. **Forward references not supported**: Constants must be defined before use
   ```c
   // ❌ Error: NEXT not defined
   .const PREV NEXT - 4
   .const NEXT 100
   ```

2. **No parentheses**: Use additional constants for complex expressions
   ```c
   // ❌ Not supported
   .const X (A + B) * 2
   
   // ✅ Use intermediate constant
   .const TEMP A + B
   .const X TEMP * 2
   ```

## Related

- [.data directive](../spec/02-program-structure.md) - Memory initialization
- [For Loops](for-loops.md) - Using constants in loop bounds
