# Latency Hide Statement (`std::latency_hide(...)`)

`std::latency_hide(...)` is a canonical scheduling statement that applies conservative cycle compaction after advanced-statement expansion.

## Canonical Syntax

```text
std::latency_hide(window=1[, mode=conservative]);
```

Accepted values:

- `window`: positive integer (`1..256`) indicating how many consecutive merge attempts are allowed from each cycle anchor.
- `mode`: currently only `conservative`.

## Semantics

`std::latency_hide(...)` runs as a deterministic post-expansion scheduler.

Two adjacent cycles are compacted only when all conditions hold:

1. No PE occupancy collision between both cycles.
2. No branch/control barrier instructions in either cycle.
3. No direct route hop dependency (a neighbor-reader in one cycle consuming a `ROUT` write from the other cycle).
4. Not both cycles containing memory operations.

Independent route steps on disjoint PEs can now be compacted (OPT-B baseline), while direct hop dependencies remain separated.

When merged, statements are preserved in lexical order and cycle indices are re-numbered deterministically.

## Example

```text
std::latency_hide(window=1, mode=conservative);
cycle { at row 1: SMUL R2, R0, R1; }
cycle { @0,3: LWI R1, 4; }
```

The second cycle is compacted into the first one when hazards are absent.

## Executable Snippet

```dsl
target "uma-cgra-base";
kernel "latency_hide_doc" {
  std::latency_hide(window=1, mode=conservative);
  cycle { at row 1: SMUL R2, R0, R1; }
  cycle { @0,3: LWI R1, 4; }
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
