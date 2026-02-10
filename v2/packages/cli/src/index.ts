#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { compile } from '@openedge/compiler-api';

interface CliArgs {
  input?: string;
  output?: string;
  targetProfile?: string;
  rows?: number;
  cols?: number;
  topology?: 'torus' | 'mesh';
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {};
  const rest = [...argv];

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
      if (topology === 'torus' || topology === 'mesh') {
        args.topology = topology;
      }
      continue;
    }
  }

  return args;
}

function printUsage(): void {
  process.stderr.write(
    'Usage: openedge-v2 <input.dsl> [-o out.csv] [--target profile] [--rows N] [--cols N] [--topology torus|mesh]\n'
  );
}

export async function runCli(argv = process.argv.slice(2)): Promise<number> {
  const args = parseArgs(argv);
  if (!args.input) {
    printUsage();
    return 1;
  }

  const sourcePath = path.resolve(process.cwd(), args.input);
  const source = await readFile(sourcePath, 'utf8');

  const result = compile(source, {
    targetProfile: args.targetProfile,
    grid: {
      rows: args.rows,
      cols: args.cols,
      topology: args.topology
    },
    emitArtifacts: ['ast', 'hir', 'mir', 'csv']
  });

  if (!result.success) {
    for (const diagnostic of result.diagnostics) {
      process.stderr.write(`${diagnostic.code} [${diagnostic.severity}] ${diagnostic.message}\n`);
      if (diagnostic.hint) {
        process.stderr.write(`  hint: ${diagnostic.hint}\n`);
      }
    }
    return 2;
  }

  const csv = result.artifacts.csv ?? '';
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
    process.stderr.write(`openedge-v2 failed: ${String(err)}\n`);
    process.exitCode = 1;
  });
}
