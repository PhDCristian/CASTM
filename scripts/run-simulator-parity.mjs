#!/usr/bin/env node

import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

const DEFAULT_TESTS = [
  'src/__tests__/dsl-compiler-parity.test.ts',
  'src/__tests__/dsl-compiler-v2-adapter.test.ts'
];

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
    simulatorPath: resolveSimulatorPath(process.env.OPENEDGE_SIMULATOR_PATH),
    install: true,
    tests: [...DEFAULT_TESTS]
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

function linkLocalOpenEdgePackages(simulatorPath) {
  const localPackages = [
    `@openedge/lang-spec@file:${path.join(projectRoot, 'packages/lang-spec')}`,
    `@openedge/compiler-ir@file:${path.join(projectRoot, 'packages/compiler-ir')}`,
    `@openedge/compiler-front@file:${path.join(projectRoot, 'packages/compiler-front')}`,
    `@openedge/compiler-backend-csv@file:${path.join(projectRoot, 'packages/compiler-backend-csv')}`,
    `@openedge/compiler-api@file:${path.join(projectRoot, 'packages/compiler-api')}`
  ];
  run('npm', ['install', '--no-save', ...localPackages], simulatorPath);
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const simulatorPkg = path.join(options.simulatorPath, 'package.json');

  if (!existsSync(simulatorPkg)) {
    console.error(
      `[openedge] Simulator repository not found at ${options.simulatorPath}. ` +
        'Pass --simulator <path> or set OPENEDGE_SIMULATOR_PATH.'
    );
    process.exit(1);
  }

  console.log(`[openedge] Using simulator at ${options.simulatorPath}`);
  if (options.install) {
    console.log('[openedge] Installing simulator dependencies (npm ci)...');
    run('npm', ['ci'], options.simulatorPath);
  }

  console.log('[openedge] Linking local @openedge/* packages into simulator...');
  linkLocalOpenEdgePackages(options.simulatorPath);

  const tests = options.tests.length > 0 ? options.tests : DEFAULT_TESTS;
  console.log(`[openedge] Running parity tests: ${tests.join(', ')}`);
  run('npm', ['test', '--', '--run', ...tests], options.simulatorPath);
}

main();
