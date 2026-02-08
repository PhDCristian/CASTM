# Advanced Features (v1.1)

[← Back to Index](../README.md)

---

This section documents the advanced language features introduced in OpenEdge-DSL v1.1.

## Features Overview

| Feature | Description | Use Case |
|---------|-------------|----------|
| [Named Arrays](named-arrays.md) | Memory regions with descriptive names | Readable data access |
| [2D Arrays](2d-arrays.md) | Matrix-like data with row-major indexing | Matrices, images |
| [Functions](functions.md) | Reusable code blocks with parameters | Common patterns, DRY |
| [For Loops](loops/for-loops.md) | Compile-time iteration | Known iteration count |
| [While Loops](loops/while-loops.md) | Runtime loops with branches | Dynamic conditions |
| [Control Flow](control-flow.md) | Structured if-else | Conditional execution |
| [Assertions](assertions.md) | `.assert` directive | Testing & verification |
| [Computed Constants](computed-constants.md) | Expressions in `.const` | Relative addresses |
| [Coordinate Expressions](coordinate-expressions.md) | `@i+1,j:` syntax | Dynamic PE selection |
| [C-like Expressions](clike-expressions.md) | `R1 = R2 + R3;` syntax | Readable arithmetic |

## Pragma Directives

| Pragma | Description | Use Case |
|--------|-------------|----------|
| [#pragma unroll](pragmas/unroll.md) | Control loop unrolling | Performance tuning |
| [#pragma parallel](pragmas/parallel.md) | SIMD-like execution | Data parallelism |
| [#pragma reduce](pragmas/reduce.md) | Tree reduction | Sum, max, min |
| [#pragma stencil](pragmas/stencil.md) | Neighbor patterns | Filtering, convolution |
| [#pragma route](pragmas/route.md) | Point-to-point routing | Cross-PE communication |
| [#pragma rotate](pragmas/rotate.md) | Circular rotation | Cyclic permutations |
| [#pragma shift](pragmas/shift.md) | Linear shift with fill | Sliding windows |

---

## Quick Reference

### Named Arrays

```c
.data input { 5, 10, 3 }
.data output 100 { 0, 0, 0 }

for i in range(input.len()) {
    cycle { @0,0: LWI R0, input[i]; }
}
```

### 2D Arrays

```c
.data2d matrix[4][4]                      // Auto-init to zeros
.data2d M[2][3] { 1, 2, 3, 4, 5, 6 }      // With values

for i in range(M.rows()) {
    for j in range(M.cols()) {
        cycle { @j,i: LWI R0, M[i][j]; }  // 2D access
    }
}
```

### Functions

```c
function DOUBLE(reg) {
    row 0: SADD reg, reg, reg | _ | _ | _;
}

cycle { DOUBLE(R0); }
```

### For Loops

```c
for i in range(4) {
    cycle { row 0: SADD R0, R0, i | _ | _ | _; }
}
```

### While Loops

```c
while (R0 < IMM(10)) @0,0 {
    cycle { @0,0: SADD R0, R0, IMM(1); }
}
```

### Control Flow

```c
if (R0 < IMM(10)) @0,0 {
    cycle { @0,0: SADD R0, R0, IMM(1); }
} else {
    cycle { @0,0: SADD R0, R0, IMM(2); }
}
```

### C-like Expressions

```c
cycle {
    @0,0: R1 = R2 + R3;       // SADD R1, R2, R3
    @0,1: R0 = R1 - 5;        // SSUB R0, R1, 5
    @0,2: ROUT = R0 * R2;     // SMUL ROUT, R0, R2
    @0,3: R1 = R0 & 0xFF;     // LAND R1, R0, 0xFF
}
```

### Pragmas

```c
#pragma parallel
for i in range(4) {
    cycle { @0,0: SADD R0, R0, i; }
}

#pragma reduce(sum, R0, ROUT)
```

---

## Navigation

- [← Back to Index](../README.md)
- [Functions →](functions.md)
