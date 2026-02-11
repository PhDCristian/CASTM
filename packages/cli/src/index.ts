#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { compile, emit } from '@openedge/compiler-api';

interface BaseArgs {
  input?: string;
  output?: string;
  targetProfile?: string;
  rows?: number;
  cols?: number;
  topology?: 'torus' | 'mesh';
  format?: 'flat-csv' | 'sim-matrix-csv';
}

interface ParsedCli {
  command: 'emit' | 'check' | 'analyze';
  args: BaseArgs;
}

function parseArgs(argv: string[]): ParsedCli {
  const rest = [...argv];
  const first = rest[0];
  const command = first === 'emit' || first === 'check' || first === 'analyze'
    ? (rest.shift() as ParsedCli['command'])
    : 'emit';

  const args: BaseArgs = {};

  while (rest.length > 0) {
    const token = rest.shift() as string;
    if (!token) break;

    if (!args.input && !token.startsWith('-')) {
      args.input = token;
      continue;
    }

    if (token === '-o' || token === '--output') {
      args.output = rest.shift();
      continue;
    }

    if (token === '--target') {
      args.targetProfile = rest.shift();
      continue;
    }

    if (token === '--rows') {
      const rows = Number(rest.shift());
      if (Number.isFinite(rows)) args.rows = rows;
      continue;
    }

    if (token === '--cols') {
      const cols = Number(rest.shift());
      if (Number.isFinite(cols)) args.cols = cols;
      continue;
    }

    if (token === '--topology') {
      const topology = rest.shift();
      if (topology === 'torus' || topology === 'mesh') args.topology = topology;
      continue;
    }

    if (token === '--format') {
      const format = rest.shift();
      if (format === 'flat-csv' || format === 'sim-matrix-csv') args.format = format;
      continue;
    }
  }

  return { command, args };
}

function printUsage(): void {
  process.stderr.write(
    'Usage:\n' +
      '  openedge emit <input.dsl> [-o out.csv] [--format flat-csv|sim-matrix-csv] [--target profile] [--rows N] [--cols N] [--topology torus|mesh]\n' +
      '  openedge check <input.dsl> [--target profile] [--rows N] [--cols N] [--topology torus|mesh]\n' +
      '  openedge analyze <input.dsl> [--target profile] [--rows N] [--cols N] [--topology torus|mesh]\n'
  );
}

function printDiagnostics(diagnostics: Array<{ code: string; severity: string; message: string; hint?: string; hintCode?: string }>): void {
  for (const diagnostic of diagnostics) {
    process.stderr.write(`${diagnostic.code} [${diagnostic.severity}] ${diagnostic.message}\n`);
    if (diagnostic.hintCode) process.stderr.write(`  migration: ${diagnostic.hintCode}\n`);
    if (diagnostic.hint) process.stderr.write(`  hint: ${diagnostic.hint}\n`);
  }
}

function resolveInputOrThrow(input: string | undefined): string {
  if (!input) throw new Error('Missing input file.');
  return path.resolve(process.cwd(), input);
}

export async function runCli(argv = process.argv.slice(2)): Promise<number> {
  const { command, args } = parseArgs(argv);

  if (!args.input) {
    printUsage();
    return 1;
  }

  const sourcePath = resolveInputOrThrow(args.input);
  const source = await readFile(sourcePath, 'utf8');

  const baseOptions = {
    targetProfile: args.targetProfile,
    grid: {
      rows: args.rows,
      cols: args.cols,
      topology: args.topology
    }
  };

  if (command === 'check') {
    const result = compile(source, { ...baseOptions, emitArtifacts: ['ast'] });
    if (!result.success) {
      printDiagnostics(result.diagnostics);
      return 2;
    }
    process.stdout.write('ok\n');
    return 0;
  }

  if (command === 'analyze') {
    const result = compile(source, { ...baseOptions, emitArtifacts: ['ast', 'hir', 'mir', 'lir'] });
    if (!result.success) {
      printDiagnostics(result.diagnostics);
      return 2;
    }
    process.stdout.write(JSON.stringify({
      success: result.success,
      stats: result.stats,
      diagnostics: result.diagnostics
    }, null, 2));
    process.stdout.write('\n');
    return 0;
  }

  const result = compile(source, {
    ...baseOptions,
    emitArtifacts: ['ast', 'hir', 'mir', 'lir']
  });

  if (!result.success) {
    printDiagnostics(result.diagnostics);
    return 2;
  }

  const emitted = emit(result.artifacts.lir ?? result.artifacts.mir!, {
    includeCycleHeader: true,
    format: args.format ?? 'flat-csv'
  });
  if (!emitted.success) {
    printDiagnostics(emitted.diagnostics);
    return 2;
  }
  const csv = emitted.csv ?? '';
  if (args.output) {
    await writeFile(path.resolve(process.cwd(), args.output), csv, 'utf8');
  } else {
    process.stdout.write(`${csv}\n`);
  }

  return 0;
}

const directRun = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (directRun) {
  runCli().then((code) => {
    process.exitCode = code;
  }).catch((err) => {
    process.stderr.write(`openedge failed: ${String(err)}\n`);
    process.exitCode = 1;
  });
}
