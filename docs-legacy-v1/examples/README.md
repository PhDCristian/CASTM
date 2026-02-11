# Examples

[← Back to Index](../README.md)

---

Complete, runnable examples organized by category.

## Basic Examples

| Example | Description |
|---------|-------------|
| [Vector Sum](basic/vector-sum.md) | Simple kernel with initialization and loops |
| [Control Flow](basic/control-flow.md) | Forward and backward jumps with labels |

## Loop Examples

| Example | Description |
|---------|-------------|
| [For Range](loops/for-range.md) | Compile-time loop patterns |
| [While Counter](loops/while-counter.md) | Basic runtime loop |
| [While Optimized](loops/while-optimized.md) | Adjacent PE optimization |
| [Factorial](loops/factorial.md) | Multi-cycle body example |

## Parallel Examples

| Example | Description |
|---------|-------------|
| [Parallel Sum](parallel/parallel-sum.md) | Basic SIMD-like operation |
| [Conditional Diff](parallel/conditional-diff.md) | If-else with BSFA conversion |
| [Reduction](parallel/reduction.md) | Sum and max reduction |
| [Triple Nested Collapse](parallel/triple-nested-collapse.md) | `collapse` vs `collapse(N)` comparison |

## FFT Examples

| Example | Description |
|---------|-------------|
| [FFT Butterfly Radix-2](fft/fft-butterfly-radix2.md) | Radix-2 DIT butterfly operations (single, parallel, 4-point) |

## Scan & Broadcast Examples

| Example | Description |
|---------|-------------|
| [Prefix Sum](scan/prefix-sum.md) | Inclusive prefix sum using `#pragma scan` |
| [Broadcast](scan/broadcast.md) | Row and column broadcast |

## Stencil & Array Examples

| Example | Description |
|---------|-------------|
| [Stencil Operations](stencil/stencil-operations.md) | 5-point, 3-point, and diagonal stencil patterns |
| [Array Expressions](stencil/array-expressions.md) | Complex index arithmetic (`M[i+1][j-1]`, `M[i*2][j%4]`) |

## Barrett Modular Exponentiation

Real-world cryptographic algorithm ported from Python to OpenEdgeDSL. Demonstrates advanced patterns:

| Module | Description |
|--------|-------------|
| [Barrett Port Overview](barrett/README.md) | Full documentation and architecture |
| Multiplication | Parallel 4×4 schoolbook multiplication |
| Squaring | Optimized A² with symmetric products |
| LimbConversion | Base conversion with pipelined carries |
| RemainderComputation | Subtraction with borrow chain |

**Source:** `examples/dsl_port/`

---

## Quick Start Template

```c
// 1. Constants and aliases
.const MAX_VALUE 100
.alias counter R0
.alias result R1

// 2. Memory initialization
.data 0 { 1, 2, 3, 4 }

// 3. IO configuration
.io_load { 0, 0, 0, 0 }
.io_store { 100, 0, 0, 0 }

// 4. Kernel
kernel "MyKernel" {
    config(0xF, 0);

    // Initialization (one instruction per PE per cycle)
    cycle {
        @0,0: SADD counter, ZERO, IMM(0);
    }
    cycle {
        @0,0: SADD result, ZERO, IMM(0);
    }

    // Main logic
    // ...

    // Exit
    cycle { @0,0: EXIT; }
}
```

---

## Navigation

- [← Back to Index](../README.md)
