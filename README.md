# CASTM -- CGRA API Spatial-Temporal Mapper

A domain-specific compiler toolchain for programming Coarse-Grained Reconfigurable Array (CGRA) architectures.
CASTM compiles high-level spatial-temporal programs (`.castm`) into cycle-accurate instruction schedules
targeting configurable CGRA grids (e.g., 4x4 PE arrays with torus/mesh interconnect).

Developed as part of a doctoral thesis at the [University of Malaga](https://www.uma.es/) (UMA),
CASTM has been validated on the [OpenEdgeCGRA](https://github.com/esl-epfl/OpenEdgeCGRA) architecture
integrated within the [HEEPsilon](https://github.com/esl-epfl/HEEPsilon) SoC,
demonstrating up to **5.58x speedup** over CPU-only execution
for the Poseidon2 zero-knowledge proof hash function (t=16, BabyBear field).

## Features

- **Spatial-temporal programming model**: Bundles group instructions across PEs per clock cycle;
  `for`, `while`, `if/else` expand into unrolled cycle schedules at compile time.
- **CGRA-aware code generation**: Emits flat or simulator-compatible CSV instruction matrices
  for arbitrary grid dimensions and topologies.
- **Structured control flow**: Labeled loops, `break`/`continue`, functions with call/return via memory,
  `include` directives, and `macro` definitions with label interpolation.
- **Communication pragmas**: `#pragma broadcast`, `reduce`, `allreduce`, `scan`, `rotate`, `shift`,
  `transpose`, `gather`, `route` -- generate multi-cycle PE coordination patterns.
- **C-like expression syntax**: Write `R0 = R1 + R2;` instead of `SADD R0, R1, R2;`.
- **Multi-target profiles**: ISA definitions, target profiles, and pragma specifications
  are data-driven (JSON), enabling retargetability.
- **Language Server Protocol**: IDE integration with diagnostics, hover info, and completions.
- **100% test coverage**: Enforced on core compiler packages via CI.

## Repository layout

```
packages/
  lang-spec/            ISA, pragmas, target profiles (JSON specs)
  compiler-ir/          Shared IR types and diagnostics
  compiler-front/       Tokenizer, parser, AST construction
  compiler-backend-csv/ CSV emitters (flat-csv, sim-matrix-csv)
  compiler-api/         Compiler facade: parse, analyze, compile, emit
  lsp-server/           Language Server Protocol implementation
  cli/                  CLI entry point (castm)
  testkit/              Test utilities
tests/                  Contract, snapshot, and doc-snippet tests
examples/               Example .castm programs
docs/                   Architecture decisions, contracts, parity matrix
docs-site/              VitePress documentation site
scripts/                Boundary checks, simulator parity runner
```

## Quick start

```bash
# Install dependencies
npm ci

# Run the full test suite
npm test

# Validate import boundaries
npm run check:boundaries

# Compile a program
npm run build --workspace @castm/cli
npx castm emit examples/basic/hello.castm -o out.csv
```

## Programmatic API

```typescript
import { compile, emit } from '@castm/compiler-api';

const source = `
  target "uma-cgra-base"
  kernel "example" {
    bundle { @0,0: SADD R0, R1, R2; }
  }
`;

const mir = compile(source);
const result = emit(mir, { format: 'sim-matrix-csv' });
console.log(result.csv);
```

## CLI usage

```bash
# Emit CSV from a .castm program
castm emit program.castm -o output.csv

# Check syntax without emitting
castm check program.castm

# Run semantic analysis
castm analyze program.castm
```

```bash
npm run test:simulator-parity -- --simulator /path/to/UMA-CGRA-Simulator
```

## Citation

If you use CASTM in your research, please cite:

```bibtex
@article{campos2026castm,
  title     = {{CASTM}: An {API} for Accelerating Zero-Knowledge Proof
               Kernels on {CGRA} Architectures},
  author    = {Campos, Cristian},
  year      = {2026}
}
```

## License

[MIT](LICENSE) -- Copyright (c) 2024-2026 Cristian Campos, University of Malaga.

## Contributing

Contributions are welcome. Please open an issue or pull request.
Before submitting, ensure:

```bash
npm test                    # All tests pass
npm run check:boundaries    # Import boundaries respected
```
