# ADR-001: Pipeline Stages

## Status
Accepted

## Decision
The compiler pipeline is explicitly staged:

`Source -> Tokens -> AST -> HIR -> MIR -> LIR(target) -> Backend artifacts`

Passes run through a typed pass manager with deterministic order and diagnostics aggregation.

## Consequences
- Each stage has stable contracts and test points.
- Transformations no longer mutate parser token streams ad-hoc.
- Observability improves (debug artifacts per stage).
