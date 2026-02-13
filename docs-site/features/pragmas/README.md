# Advanced Statements

Advanced statements provide high-level canonical operations that lower to deterministic multi-cycle ISA patterns.

## Statement Matrix

| Statement | Main Use | Key Options |
|---|---|---|
| `route(...)` | directional transfer between points | `payload`, `accum` or `dest+op` |
| `broadcast(...)` | fan-out from one source point | `value`, `from`, `to` |
| `reduce(...)` / `allreduce(...)` | lane/global reductions | `op`, `dest`, `src`, `axis` |
| `scan(...)` | prefix scan over lanes | `op`, `dir`, `mode` |
| `rotate(...)` / `shift(...)` | lane value motion | `reg`, `direction`, `distance`, `fill` |
| `stencil(...)` | neighborhood stencils | `pattern`, `op`, `src`, `dest` |
| `collect(...)` | single-hop lane collection | `from`, `to`, `via`, `combine` |
| `normalize(...)` | carry normalization per lane | `reg`, `carry`, `width`, `lane`, `axis` |
| `extract_bytes(...)` | byte-lane extraction | `src`, `dest`, `axis`, `byteWidth` |
| `carry_chain(...)` | multi-limb carry propagation | `src`, `carry`, `store`, `limbs`, `width` |
| `conditional_sub(...)` | branchless conditional subtraction | `value`, `sub`, `dest`, `target` |
| `guard(...)` | predicate-based spatial activation | `cond`, `op`, `dest`, `srcA`, `srcB` |
| `triangle(...)` | upper/lower triangle pattern | `shape`, `inclusive`, `op` |
| `stream_load/store(...)` | stream pointer IO operations | `dest/src`, `row`, `count` |
| `latency_hide(...)` | conservative cycle compaction | `window`, `mode` |
| `stash(...)` | explicit save/restore spill points | `action`, `reg`, `addr`, `target` |
| `pipeline(...)` | ordered function-call composition | list of function calls |

## Determinism

- Lowering order follows lexical kernel order.
- Generated cycles receive stable ordering and indexing.
- Emitted ISA/CSV remains backend-compatible (`flat-csv`, `sim-matrix-csv`).
