# Deprecation Policy (v1 -> v2 Transition)

This policy defines how legacy integration paths are phased out after v2 cutover.

## Current transition state

- v2 packages (`@openedge/*`) are the primary integration surface.
- Root compatibility exports in `compat/*` have been removed.
- Simulator no longer uses a legacy compiler fallback path.

## Policy rules

1. No new features are added to legacy integration paths.
2. Fixes land in v2 first; legacy receives only critical compatibility fixes.
3. Downstream repos must consume versioned `@openedge/*` packages.
4. Internal source imports (`.../src/...`) are non-contractual and unsupported.

## Removal milestones

### Milestone M1 (current + migration window)
- Compatibility exports are removed.
- CI parity must stay green for stable feature set.

### Milestone M2 (after sustained parity)
- Legacy backend setting (if present in UI) remains only as alias to v2.
- Begin warning on compatibility entrypoint usage in integration docs/tooling.

### Milestone M3 (major release boundary)
- Remove any remaining alias paths and references to legacy backend options.
- Keep migration docs archived for reference.

## Decision gate to remove compatibility layer

Compatibility entrypoints can be removed when all are true:

- Cross-repo parity is green for a sustained window.
- Simulator default path is v2 with no stable-feature fallback.
- No known production consumers rely on compatibility exports.
- Migration guide adoption is complete for maintained downstream repos.
