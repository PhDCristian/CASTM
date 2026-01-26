# Pragma Directives

[← Assertions](../assertions.md) | [Main Index](../../README.md)

---

Pragma directives provide fine-grained control over compiler behavior. They are placed immediately before the construct they affect.

## Syntax

```c
#pragma <directive> [(<arguments>)]
```

---

## Available Pragmas

| Pragma | Target | Description |
|--------|--------|-------------|
| [`#pragma unroll`](unroll.md) | for loop | Force complete unrolling (default) |
| [`#pragma unroll(N)`](unroll.md) | for loop | Partial unrolling (first N iterations) |
| [`#pragma no_unroll`](unroll.md) | for loop | Generate runtime loop with branches |
| [`#pragma parallel`](parallel.md) | for loop | Distribute iterations across columns |
| [`#pragma reduce`](reduce.md) | standalone | Tree reduction across columns |
| [`#pragma scan`](scan.md) | standalone | Prefix operations (scan) across PEs |
| [`#pragma broadcast`](broadcast.md) | standalone | Distribute value from one PE to many |
| [`#pragma stencil`](stencil.md) | standalone | Neighbor communication patterns |
| [`#pragma route`](route.md) | standalone | Toroidal PE-to-PE routing |
| `#pragma inline` | function | Force inlining (default) |
| `#pragma no_fuse` | while loop | Disable body+jump fusion |

---

## Quick Examples

### Loop Unrolling Control

```c
// Default: fully unrolled at compile time
for i in range(4) { ... }

// Force partial unrolling
#pragma unroll(2)
for i in range(8) { ... }  // Only first 2 iterations

// Generate runtime loop
#pragma no_unroll
for R0 in range(0, 100) @0,0 { ... }
```

### Parallel Execution

```c
#pragma parallel
for i in range(4) {
    cycle { @0,0: LWI R0, data[i]; }
    cycle { @0,0: SADD ROUT, R0, R0; }
}
// All 4 iterations execute simultaneously across columns
```

### Reduction

```c
#pragma reduce(sum, R0, ROUT)
// Sums R0 from all columns → ROUT in column 0
```

### Stencil

```c
#pragma stencil(cross, R0, ROUT)
// Each PE sums its value + 4 neighbors
```

---

## Pragma Scope

Each pragma applies to the **immediately following** construct:

```c
#pragma parallel  // Applies to this for loop
for i in range(4) {
    cycle { ... }
}

// This for loop is NOT affected by the pragma above
for j in range(4) {
    cycle { ... }
}
```

---

## Documentation

| Document | Coverage |
|----------|----------|
| [Unroll](unroll.md) | `unroll`, `unroll(N)`, `no_unroll` |
| [Parallel](parallel.md) | SIMD-like column distribution |
| [Reduce](reduce.md) | Tree reduction (sum, max, min, and, or) |
| [Scan](scan.md) | Prefix operations (add, max, min, and, or, xor) |
| [Broadcast](broadcast.md) | Value distribution (row, column, all) |
| [Stencil](stencil.md) | Neighbor patterns (cross, horizontal, vertical) |
| [Route](route.md) | Toroidal routing between arbitrary PEs |

---

## Navigation

- [← Assertions](../assertions.md)
- [Main Index](../../README.md)
- [Unroll →](unroll.md)
