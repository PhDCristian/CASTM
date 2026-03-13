# Latency Hide Statement (`std::latency_hide(...)`)

`std::latency_hide(...)` is a canonical scheduling statement that applies conservative cycle compaction after advanced-statement expansion.

## Canonical Syntax

```text
std::latency_hide(window=1[, mode=conservative]);
```

Accepted values:

- `window`: integer (`>=0`) indicating lookahead for placement packing (`0` disables packing).
- `mode`: currently only `conservative`.

## Semantics

`std::latency_hide(...)` runs as a deterministic post-expansion scheduler.

Packing is placement-level inside a bounded lookahead window (`scheduler_window` from `build { ... }`), not only full-cycle merge.

Placements are moved earlier only when all conditions hold:

1. No PE occupancy collision between both cycles.
2. No branch/control barrier is crossed.
3. No direct route hop dependency is crossed (incoming readers `RCL/RCR/RCT/RCB/INCOMING` fence `ROUT` producers).
4. Memory policy allows the move (`strict` or `same-address-fence`).

Independent route steps on disjoint PEs can be compacted, while direct hop dependencies remain separated.

When compacted:

- lexical order is preserved deterministically,
- cycle indices are re-numbered deterministically,
- numeric branch targets are remapped to the new cycle indices.

## Example

```text
std::latency_hide(window=1, mode=conservative);
bundle { at row 1: SMUL R2, R0, R1; }
bundle { @0,3: LWI R1, 4; }
```

The second cycle is compacted into the first one when hazards are absent.

## Executable Snippet

```dsl
target base;
kernel "latency_hide_doc" {
  std::latency_hide(window=1, mode=conservative);
  bundle { at row 1: SMUL R2, R0, R1; }
  bundle { @0,3: LWI R1, 4; }
}
```

## Diagnostics

- malformed argument sets are rejected with parse diagnostics.
- unsupported modes are rejected explicitly.

## Verification

Executable contract tests:

- `tests/issues/feat-01-latency-hide.test.ts`
- `tests/compiler-api.latency-hide.test.ts`
- `tests/issues/opt-b-route-parallel-pack.test.ts`
