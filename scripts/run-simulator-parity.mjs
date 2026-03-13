#!/usr/bin/env node

import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

const PARITY_TEST = 'src/__tests__/dsl-compiler-parity.test.ts';

const projectRoot = path.resolve(import.meta.dirname, '..');

function resolveSimulatorPath(raw) {
  if (raw) {
    return path.isAbsolute(raw) ? raw : path.resolve(projectRoot, raw);
  }

  const candidates = [
    path.resolve(projectRoot, '../../UMA-CGRA-Simulator'),
    path.resolve(projectRoot, '../UMA-CGRA-Simulator')
  ];
  for (const candidate of candidates) {
    if (existsSync(path.join(candidate, 'package.json'))) {
      return candidate;
    }
  }

  return candidates[0];
}

function parseArgs(argv) {
  const options = {
    simulatorPath: resolveSimulatorPath(process.env.CASTM_SIMULATOR_PATH),
    install: true,
    tests: []
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--simulator' && argv[i + 1]) {
      options.simulatorPath = resolveSimulatorPath(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg === '--skip-install') {
      options.install = false;
      continue;
    }
    if (arg === '--test' && argv[i + 1]) {
      options.tests.push(argv[i + 1]);
      i += 1;
      continue;
    }
  }

  return options;
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    shell: false
  });
  if (result.error) {
    throw result.error;
  }
  if (typeof result.status === 'number' && result.status !== 0) {
    process.exit(result.status);
  }
}

function discoverDefaultTests(simulatorPath) {
  const tests = [PARITY_TEST];
  const testsDir = path.join(simulatorPath, 'src', '__tests__');
  if (!existsSync(testsDir)) {
    return tests;
  }

  const entries = readdirSync(testsDir).filter((name) => name.endsWith('.test.ts'));
  const adapterCandidates = entries
    .filter((name) => /^dsl-compiler-.*adapter.*\.test\.ts$/i.test(name))
    .sort((a, b) => a.localeCompare(b));

  const preferred = adapterCandidates.find((name) => /^dsl-compiler-adapter\.test\.ts$/i.test(name))
    ?? adapterCandidates[0];
  if (preferred) {
    tests.push(`src/__tests__/${preferred}`);
  }

  return tests;
}

function linkLocalCastmPackages(simulatorPath) {
  const localPackages = [
    `@castm/lang-spec@file:${path.join(projectRoot, 'packages/lang-spec')}`,
    `@castm/compiler-ir@file:${path.join(projectRoot, 'packages/compiler-ir')}`,
    `@castm/compiler-front@file:${path.join(projectRoot, 'packages/compiler-front')}`,
    `@castm/compiler-backend-csv@file:${path.join(projectRoot, 'packages/compiler-backend-csv')}`,
    `@castm/compiler-api@file:${path.join(projectRoot, 'packages/compiler-api')}`
  ];
  run('npm', ['install', '--no-save', ...localPackages], simulatorPath);
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const simulatorPkg = path.join(options.simulatorPath, 'package.json');

  if (!existsSync(simulatorPkg)) {
    console.error(
      `[castm] Simulator repository not found at ${options.simulatorPath}. ` +
        'Pass --simulator <path> or set CASTM_SIMULATOR_PATH.'
    );
    process.exit(1);
  }

  console.log(`[castm] Using simulator at ${options.simulatorPath}`);
  if (options.install) {
    console.log('[castm] Installing simulator dependencies (npm ci)...');
    run('npm', ['ci'], options.simulatorPath);
  }

  console.log('[castm] Linking local @castm/* packages into simulator...');
  linkLocalCastmPackages(options.simulatorPath);

  const tests = options.tests.length > 0 ? options.tests : discoverDefaultTests(options.simulatorPath);
  console.log(`[castm] Running parity tests: ${tests.join(', ')}`);
  run('npm', ['test', '--', '--run', ...tests], options.simulatorPath);
}

main();
