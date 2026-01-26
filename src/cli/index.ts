#!/usr/bin/env node
/**
 * OpenEdgeDSL CLI
 * 
 * Command-line interface for the OpenEdge-DSL compiler.
 * Compile, validate, and analyze DSL programs for CGRA architectures.
 */

import { Command } from 'commander';
import { compileCommand } from './commands/compile.js';
import { checkCommand } from './commands/check.js';
import { infoCommand } from './commands/info.js';
import { runInteractiveMode } from './commands/interactive.js';

// Package version (will be updated from package.json in build)
const VERSION = '0.1.0';

const program = new Command();

program
  .name('openedge')
  .description('OpenEdge-DSL compiler for CGRA programming')
  .version(VERSION, '-v, --version', 'Output the current version')
  .helpOption('-h, --help', 'Display help for command');

// Add commands
program.addCommand(compileCommand);
program.addCommand(checkCommand);
program.addCommand(infoCommand);

// Interactive mode command
program
  .command('interactive')
  .alias('i')
  .description('Launch interactive menu-driven mode')
  .action(async () => {
    await runInteractiveMode();
  });

// Custom help
program.addHelpText('after', `

Examples:
  $ openedge compile kernel.dsl              Compile to kernel.csv
  $ openedge compile kernel.dsl -o out.csv   Compile to out.csv
  $ openedge check kernel.dsl                Validate without output
  $ openedge info kernel.dsl                 Show program statistics
  $ openedge info kernel.dsl --json          Output stats as JSON
  $ openedge interactive                     Launch interactive mode
  $ openedge i                               (shortcut for interactive)

Documentation:
  https://github.com/PhDCristian/OpenEdgeDSL
`);

// If no command provided, launch interactive mode
if (process.argv.length <= 2) {
  runInteractiveMode();
} else {
  program.parse();
}
