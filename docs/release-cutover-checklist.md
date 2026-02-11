# v2 Release and Cutover Checklist

This checklist defines the release gate for making v2 the operational default across repositories.

## Preconditions

- `docs/feature-parity-matrix.md` shows stable v1 set as `done`.
- Cross-repo parity fixtures are green.
- No direct imports to OpenEdgeDSL internal `src` paths in downstream repos.

## Gate A: Local quality gates

Run from OpenEdgeDSL root:

```bash
npm test
npm run check:boundaries
npm run docs:generate
```

Expected:
- All tests pass.
- Boundary checker passes.
- Docs generation succeeds without drift.

## Gate B: Cross-repo parity

```bash
npm run test:simulator-parity -- --simulator /path/to/UMA-CGRA-Simulator --skip-install
```

Expected:
- `dsl-compiler-parity` suite green.
- `dsl-compiler-v2-adapter` suite green.

## Gate C: Package publication readiness

1. Verify package versions are aligned across `packages/*`.
2. Publish `@openedge/*` packages.
3. Update simulator dependencies to fixed semver versions.

## Gate D: Simulator default backend cutover

1. Set v2 as default backend.
2. Keep legacy backend as explicit opt-in only (temporary).
3. Re-run simulator integration and parity suites.

## Gate E: Post-cutover hardening

1. Monitor parity suites for regressions on each PR.
2. Keep docs snippets executable in CI.
3. Track any remaining legacy entrypoint usage and deprecate by policy.

## Exit Criteria

- v2 is default in simulator with parity CI green.
- Stable feature set compiles/runs without legacy fallback.
- Versioned package consumption is enforced in downstream integrations.
