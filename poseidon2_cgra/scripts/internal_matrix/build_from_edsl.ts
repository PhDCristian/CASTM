#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { parse, analyze, emit } from '@openedge/compiler-api';

interface CliOptions {
  edsl: string;
  out: string;
  format: 'sim-matrix-csv' | 'flat-csv';
}

function parseArgs(argv: string[]): CliOptions {
  const defaults: CliOptions = {
    edsl: 'poseidon2_cgra/kernels/linear/internal_matrix/internal_matrix_async.edsl',
    out: 'poseidon2_cgra/kernels/linear/internal_matrix/instructions_openedge_candidate.csv',
    format: 'sim-matrix-csv'
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--edsl' && i + 1 < argv.length) {
      defaults.edsl = argv[++i];
      continue;
    }
    if (arg === '--out' && i + 1 < argv.length) {
      defaults.out = argv[++i];
      continue;
    }
    if (arg === '--format' && i + 1 < argv.length) {
      const value = argv[++i];
      if (value === 'sim-matrix-csv' || value === 'flat-csv') {
        defaults.format = value;
      } else {
        throw new Error(`Invalid --format '${value}', expected sim-matrix-csv|flat-csv`);
      }
      continue;
    }
    throw new Error(`Unknown argument '${arg}'.`);
  }

  return defaults;
}

function failWithDiagnostics(context: string, diagnostics: Array<{ code: string; severity: string; message: string }>): never {
  console.error(`${context} failed with diagnostics:`);
  for (const d of diagnostics) {
    console.error(`- [${d.code}] ${d.severity}: ${d.message}`);
  }
  process.exit(1);
}

function main(): void {
  const options = parseArgs(process.argv.slice(2));
  const edslPath = resolve(options.edsl);
  const outPath = resolve(options.out);
  const source = readFileSync(edslPath, 'utf8');

  const parsed = parse(source, {});
  if (!parsed.success || !parsed.ast) {
    failWithDiagnostics('parse', parsed.diagnostics);
  }

  const analysis = analyze({ ast: parsed.ast, structuredAst: parsed.structuredAst }, {});
  if (!analysis.success || !analysis.mir) {
    failWithDiagnostics('analyze', analysis.diagnostics);
  }

  const emitted = emit(analysis.lir ?? analysis.mir, { format: options.format });
  if (!emitted.success || !emitted.csv) {
    failWithDiagnostics('emit', emitted.diagnostics);
  }

  const normalizedCsv = emitted.csv
    .split(/\r?\n/)
    .map((line) => {
      const match = line.match(/^(\d+),,,\s*$/);
      return match ? match[1] : line;
    })
    .join('\n')
    .trimEnd();

  writeFileSync(outPath, `${normalizedCsv}\n`, 'utf8');

  console.log(JSON.stringify({
    edsl: edslPath,
    out: outPath,
    cycles: analysis.mir.cycles.length,
    format: options.format,
    simulatorCompatHeaders: true,
    diagnostics: {
      parse: parsed.diagnostics.length,
      analyze: analysis.diagnostics.length,
      emit: emitted.diagnostics.length
    }
  }, null, 2));
}

main();
