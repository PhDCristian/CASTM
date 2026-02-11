# OpenEdgeDSL

OpenEdgeDSL now uses a single architecture based on the new multi-package compiler pipeline.

## Repository layout

- `packages/lang-spec`: ISA, pragmas, target profiles, generated reference docs.
- `packages/compiler-front`: tokenizer/parser and AST construction.
- `packages/compiler-ir`: shared IR and diagnostics types.
- `packages/compiler-api`: facade (`parse`, `analyze`, `compile`, `emit`) and passes.
- `packages/compiler-backend-csv`: CSV emitters (`flat-csv`, `sim-matrix-csv`).
- `packages/lsp-server`: language-server package.
- `packages/cli`: CLI (`openedge`).
- `packages/testkit`: test helpers.
- `tests`: contract and docs-snippet tests.
- `scripts`: repo checks and simulator parity runner.
- `docs`: ADRs, parity matrix and generated instruction reference.
- `docs-legacy`: archived historical documentation.

## Quick start

```bash
npm ci
npm test
npm run check:boundaries
npm run test:simulator-parity -- --simulator /path/to/UMA-CGRA-Simulator --skip-install
```

## CLI

```bash
npm run build --workspace @openedge/cli
npx openedge program.dsl -o out.csv
```

## Notes

- The previous compiler tree (`src`, legacy CLI/TUI, VSCode extension sources) has been removed from active development.
- Simulator integration is validated through `scripts/run-simulator-parity.mjs` and CI workflow `cross-repo-parity.yml`.

## Release and migration docs

- `CHANGELOG.md`
- `docs/migration-from-legacy.md`
- `docs/release-cutover-checklist.md`
- `docs/deprecation-policy.md`
