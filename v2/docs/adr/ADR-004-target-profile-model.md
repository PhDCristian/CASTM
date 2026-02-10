# ADR-004: Target Profile Model

## Status
Accepted

## Decision
Target behavior is driven by declarative profiles:

`TargetProfile { id, grid, topology, wrapPolicy, registers, neighbors }`

Compiler options may override grid dimensions while preserving profile semantics.

## Consequences
- 4x4 is a profile default, not a structural hardcode.
- NxM support is portable across front/back ends.
- Simulator integration can pin versions by profile and package version.
