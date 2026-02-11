# ADR-002: IR Model

## Status
Accepted

## Decision
The compiler defines separate `AST`, `HIR`, and `MIR` structures:
- `AST`: syntactic representation of source.
- `HIR`: normalized semantic statements.
- `MIR`: grid-normalized per-cycle per-PE operations.

`MIR` is backend-facing and target-aware (`GridSpec`, topology).

## Consequences
- Backends do not depend on parser quirks.
- Validation and optimization can be isolated by layer.
- Contract tests can assert each phase independently.
