# OpenEdgeDSL Issue Status Matrix

Last updated: 2026-02-10

This matrix classifies items from `ISSUES_SBOX_K7_PORT.md` by source of truth:

- `OpenEdgeDSL`: status in this repository (compiler + local tests)
- `Simulator`: status in `UMA-CGRA-Simulator` integration wrapper
- `Docs`: status of documentation consistency

| Item | OpenEdgeDSL | Simulator | Docs | Notes |
|---|---|---|---|---|
| Issue 1 (`all:` in functions) | Resolved | Synced (wrapper uses upstream compiler) | Updated | Function label prefixing now excludes `all:` tokenization path. |
| Issue 2 (`R3 = ZERO`) | Resolved | Synced (wrapper uses upstream compiler) | Updated | Covered by expression desugar tests. |
| Issue 3 (C-like in multi-`@`) | Resolved | Synced (wrapper uses upstream compiler) | Updated | Covered by expression desugar e2e tests. |
| Issue 4 (C-like in `row` pipe) | Resolved | Synced (wrapper uses upstream compiler) | Updated | `|` row-separator handling preserved. |
| Issue 5 (`row N: instr;` broadcast) | Resolved | Synced (contract test in simulator) | Updated | Compile + simulation tests for row broadcast, including mixed row styles. |
| Issue 6 (`for` inside `cycle`) | Resolved | Synced (wrapper uses upstream compiler) | Updated | Implemented with same-cycle expansion and PE conflict diagnostics. |
| Issue 7 (`#pragma auto_cycle` in functions) | Not re-verified in this wave | Not re-verified in this wave | Pending | Requires dedicated regression suite. |
| Issue 8 (`#pragma parallel` without collapse) | By design | By design | Pending clarification | Remains serial unless `collapse` is used. |
| Issue 9 (`col N:`) | Resolved | Synced (wrapper uses upstream compiler) | Updated | Implemented and covered by tests. |
| Issue 10 (`for col in ...`) | By design | By design | Pending clarification | `col` remains reserved. |
| Issue 11 (collapse cycles cannot merge mixed blocks) | Pending enhancement | Pending enhancement | Pending | Not part of this implementation wave. |
| Issue 12 (`&` parse error) | Resolved | Synced (wrapper uses upstream compiler) | Updated | Operator supported in lexer/desugar. |

## BUG Group (from same report)

| Item | OpenEdgeDSL | Simulator | Docs | Notes |
|---|---|---|---|---|
| BUG-1 (row auto-broadcast mixed styles corruption) | Resolved | Synced (integration test) | Updated | Added simulation regression in local test suite. |
| BUG-2 (`&` not tokenized) | Resolved | Synced (wrapper uses upstream compiler) | Updated | Root cause was stale DSL copy. |
| BUG-3 (desugar pass missing in simulator pipeline) | N/A in this repo | Resolved | Updated | Simulator now imports compiler pipeline directly from OpenEdgeDSL. |
| BUG-4 (missing code-gen pragmas in simulator pipeline) | N/A in this repo | Resolved | Updated | No local reimplementation path remains in simulator wrapper. |
| BUG-5 (stale `libs/OpenEdgeDSL` copy) | N/A in this repo | Mitigated + guarded | Updated | Wrapper/core parity test detects drift in compiler behavior. |
| BUG-6 (function parameter names in C-like desugar) | Resolved | Synced (wrapper uses upstream compiler) | Updated | Fixed by broadening destination support in desugar pass. |
