# Coordinate Expressions

Loop variables can be used in PE coordinate specifications with arithmetic expressions.

## Syntax

```c
@row_expr,col_expr: INSTRUCTION;
```

Where `row_expr` and `col_expr` can be:
- A literal number: `@0,1:`
- A loop variable: `@i,j:`
- An arithmetic expression: `@i+1,j*2:`

## Examples

### Simple Variable Substitution

<!-- expect: SADD R0, ZERO, 1 at (1,1) -->
```c
kernel "SimpleCoords" {
    config(0xF, 0);
    
    for i in range(2) {
        for j in range(2) {
            cycle {
                @i,j: SADD R0, ZERO, 1;
            }
        }
    }
    
    cycle { @0,0: EXIT; }
}
```

This generates instructions at:
- `@0,0`, `@0,1`, `@1,0`, `@1,1`

### Expressions in Coordinates

<!-- expect: SADD R1, ZERO, 2 at (0,1) and (1,2) -->
```c
kernel "ExprCoords" {
    config(0xF, 0);
    
    for k in range(2) {
        cycle {
            @k,k+1: SADD R1, ZERO, 2;
        }
    }
    
    cycle { @0,0: EXIT; }
}
```

This generates:
- k=0: `@0,1: SADD R1, ZERO, 2`
- k=1: `@1,2: SADD R1, ZERO, 2`

### Diagonal Pattern

```c
// Execute on main diagonal (@0,0), (@1,1), (@2,2), (@3,3)
for d in range(4) {
    cycle {
        @d,d: SADD R3, ZERO, ZERO;
    }
}
```

### Offset Pattern

```c
// Carry propagation: each PE receives from previous
for col in range(1, 4) {
    cycle {
        @0,col: SADD R0, R0, RCL;      // Add from left neighbor
        @0,col-1: SADD ROUT, R3, ZERO; // Send to right
    }
}
```

## Supported Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `+` | Addition | `@i+1,j:` |
| `-` | Subtraction | `@i,j-1:` |
| `*` | Multiplication | `@i*2,j:` |
| `/` | Division | `@i/2,j:` |
| `%` | Modulo | `@i%4,j:` |

## Multi-Variable Expressions

```c
for i in range(2) {
    for j in range(2) {
        cycle {
            @i*2,j*2: SADD R0, ZERO, 1;  // @0,0, @0,2, @2,0, @2,2
        }
    }
}
```

## Bounds Checking

Coordinate expressions are evaluated at compile time. Values are automatically wrapped to the 4x4 grid (modulo 4).

```c
for i in range(4) {
    cycle {
        @i,i+1: SADD R0, ZERO, 1;
    }
}
// Generates: @0,1, @1,2, @2,3, @3,0 (wrap-around)
```

## Use Cases

### Parallel Reduction (Tree Pattern)

```c
// 4→2 reduction
for i in range(2) {
    cycle {
        @0,i*2: LWI R0, base + i*8;      // Load at evens
        @0,i*2+1: LWI R1, base + i*8+4;  // Load at odds
    }
    cycle {
        @0,i*2: SADD R0, R0, RCR;        // Add from right
    }
}
```

### Staggered Pipeline

```c
// Each column processes a different stage
for col in range(4) {
    cycle {
        @0,col: LWI R0, input_base + col*4;
    }
    cycle {
        @1,col: SMUL R1, R0, R0;  // Square in next row
    }
}
```

## Limitations

1. **Toroidal wrapping**: Out-of-bounds coordinates wrap around the 4x4 grid
2. **Compile-time evaluation**: Expressions must be resolvable at compile time
3. **No parentheses in coordinates**: Use simple expressions

## Related

- [For Loops](loops/for-loops.md) - Loop syntax and unrolling
- [#pragma parallel](pragmas/parallel.md) - Alternative for column distribution
