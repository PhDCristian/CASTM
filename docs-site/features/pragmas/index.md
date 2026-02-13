# Advanced Statements

Advanced statements provide high-level canonical operations that lower to deterministic multi-cycle ISA patterns.

Canonical standard form uses `std::` (for example `std::route(...)`).

Loop-level parallel strategy is expressed with canonical `for` modifiers (`unroll(k)`, `collapse(n)`), not with legacy pragma syntax.

## Statement Matrix

| Statement | Main Use | Key Options |
|---|---|---|
| `std::route(...)` | directional transfer between points | `payload`, `accum` or `dest+op` |
| `std::broadcast(...)` | fan-out from one source point | `value`, `from`, `to` |
| `std::reduce(...)` / `std::allreduce(...)` | lane/global reductions | `op`, `dest`, `src`, `axis` |
| `std::scan(...)` | prefix scan over lanes | `op`, `dir`, `mode` |
| `std::rotate(...)` / `std::shift(...)` | lane value motion | `reg`, `direction`, `distance`, `fill` |
| `std::stencil(...)` | neighborhood stencils | `pattern`, `op`, `src`, `dest` |
| `std::collect(...)` | single-hop lane collection | `from`, `to`, `via`, `combine` |
| `std::normalize(...)` | carry normalization per lane | `reg`, `carry`, `width`, `lane`, `axis` |
| `std::extract_bytes(...)` | byte-lane extraction | `src`, `dest`, `axis`, `byteWidth` |
| `std::mulacc_chain(...)` | lane multiply-accumulate propagation | `src`, `coeff`, `acc`, `out`, `target`, `width` |
| `std::carry_chain(...)` | multi-limb carry propagation | `src`, `carry`, `store`, `limbs`, `width` |
| `std::conditional_sub(...)` | branchless conditional subtraction | `value`, `sub`, `dest`, `target` |
| `std::guard(...)` | predicate-based spatial activation | `cond`, `op`, `dest`, `srcA`, `srcB` |
| `std::triangle(...)` | upper/lower triangle pattern | `shape`, `inclusive`, `op` |
| `std::stream_load/store(...)` | stream pointer IO operations | `dest/src`, `row`, `count` |
| `std::latency_hide(...)` | conservative cycle compaction | `window`, `mode` |
| `std::stash(...)` | explicit save/restore spill points | `action`, `reg`, `addr`, `target` |
| `pipeline(...)` | ordered function-call composition | list of function calls |

## Determinism

- Lowering order follows lexical kernel order.
- Generated cycles receive stable ordering and indexing.
- Emitted ISA/CSV remains backend-compatible (`flat-csv`, `sim-matrix-csv`).
