# FFT Examples for OpenEdgeDSL

[← Examples Index](../README.md) | [Main Index](../../README.md)

---

This directory contains FFT Radix-2 Butterfly implementations for CGRA, based on the paper *"Efficient and Flexible Implementation of FFT Application for CGRA Processor"* (Yi et al., ICSP 2023).

## Quick Start

| If you want to... | Use this file |
|-------------------|---------------|
| Understand FFT basics | [fft-butterfly-radix2.md](fft-butterfly-radix2.md) |
| See complex multiplication | [fft-complex-multiplication.md](fft-complex-multiplication.md) |
| Learn parallel optimization | [fft-dual-parallel.md](fft-dual-parallel.md) |

## Progression Guide

### 1️⃣ Basic Butterfly (Unity Twiddle)
**File:** `fft_butterfly_full_dfg.dsl`  
**Complexity:** ⭐

Simplest butterfly with W=1. No complex multiplication needed.
```
Top = X[k] + X[k+L]
Bottom = X[k] - X[k+L]
```

### 2️⃣ Complex Multiplication
**File:** `fft_butterfly_complex.dsl`  
**Complexity:** ⭐⭐⭐

Real FFT with complex twiddle factors and fixed-point arithmetic.
```
Product = X[k+L] × W  (4 multiplications + shifts)
Top = X[k] + Product
Bottom = X[k] - Product
```

### 3️⃣ Dual Parallel (Paper's Optimization)
**File:** `fft_dual_optimized.dsl`  
**Complexity:** ⭐⭐⭐⭐

Two butterflies run simultaneously using parallel loads and multiplications.

## Performance Comparison

| Implementation | Cycles | Latency | Butterflies | **Lat/Butterfly** |
|----------------|--------|---------|-------------|-------------------|
| fft_butterfly_full_dfg | ~17 | ~30 | 1 | 30 |
| fft_butterfly_complex | 42 | 78 | 1 | **78** |
| fft_dual_optimized | 43 | 77 | 2 | **38.5** ✨ |

**Best choice:** `fft_dual_optimized.dsl` - 2x throughput improvement

## Documentation

| Document | Content |
|----------|---------|
| [fft-butterfly-radix2.md](fft-butterfly-radix2.md) | Algorithm overview and code examples |
| [fft-complex-multiplication.md](fft-complex-multiplication.md) | Complex mul + fixed-point math |
| [fft-dual-parallel.md](fft-dual-parallel.md) | Parallel optimization techniques |

## DSL Files

| File | Description | Status |
|------|-------------|--------|
| `fft_butterfly_simple.dsl` | Integer-only butterfly | ✅ |
| `fft_butterfly_full_dfg.dsl` | Unity twiddle (W=1) | ✅ |
| `fft_butterfly_complex.dsl` | Complex multiplication | ✅ |
| `fft_dual_parallel.dsl` | Simple dual parallel | ✅ |
| `fft_butterfly_dual_complex.dsl` | Dual complex (sequential) | ✅ |
| `fft_dual_optimized.dsl` | **Optimized dual parallel** | ✅ ✨ |

---

## Navigation

- [← Examples Index](../README.md)
- [Main Index](../../README.md)
