# Barrett Port Examples

This directory contains the OpenEdgeDSL port of the Barrett Modular Exponentiation algorithm.

## Quick Links

| Document | Description |
|----------|-------------|
| [Full Documentation](README.md) | Complete guide with patterns and verification |
| [Source Files](../../../../examples/dsl_port/) | Actual `.edsl` files |
| [Verification Scripts](../../../../scripts/) | Test scripts for each module |

## Quick Start

```bash
# Compile and verify the main orchestrator
npx vite-node scripts/verify_barrett.ts

# Run full E2E test with simulator
npx vite-node scripts/e2e_simulator_test.ts
```

## Module Summary

| Module | Lines | Purpose |
|--------|-------|---------|
| `multiplication.edsl` | 152 | Schoolbook A×B |
| `squaring.edsl` | 165 | Optimized A² |
| `limb_conversion.edsl` | 103 | Base-8 → Base-16 |
| `remainder_computation.edsl` | 96 | R = L - RH |
| `barrett_modexp.edsl` | 132 | Main orchestrator |

## See Also

- [Porting Guide](../../porting-guide.md) - General porting patterns
- [#pragma route](../../features/pragmas/route.md) - Routing directive
