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
import { startWatchMode } from './commands/watch.js';
import { setTheme, getThemeNames, BUILTIN_THEMES } from './config/store.js';
import { runTuiMode } from './tui/index.js';

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

// Watch mode command
program
  .command('watch')
  .alias('w')
  .description('Watch file for changes and auto-recompile')
  .argument('<file>', 'DSL source file to watch')
  .option('-o, --output <file>', 'Output CSV file')
  .action(async (file: string, options: { output?: string }) => {
    await startWatchMode(file, options.output);
  });

// Interactive mode command
program
  .command('interactive')
  .alias('i')
  .description('Launch interactive menu-driven mode')
  .action(async () => {
    await runInteractiveMode();
  });

// TUI mode command (new React-like interface)
program
  .command('tui')
  .alias('t')
  .description('Launch TUI mode with side-by-side preview (experimental)')
  .action(() => {
    // Clear screen for immersive experience
    console.clear();
    process.stdout.write('\x1b[?1049h'); // Enable alternate screen buffer
    
    // Handle exit to restore screen
    process.on('exit', () => {
      process.stdout.write('\x1b[?1049l'); // Disable alternate screen buffer
    });
    
    runTuiMode();
  });

// Theme command
program
  .command('theme')
  .description('Change the CLI theme')
  .argument('[name]', 'Theme name (list available if omitted)')
  .action((name?: string) => {
    const themes = getThemeNames();
    
    if (!name) {
      console.log('\nAvailable themes:\n');
      themes.forEach(t => {
        const theme = BUILTIN_THEMES[t];
        console.log(`  • ${theme.name} (${t})`);
      });
      console.log('\nUsage: openedge theme <name>\n');
      return;
    }
    
    if (setTheme(name)) {
      console.log(`\nTheme changed to: ${BUILTIN_THEMES[name].name}\n`);
    } else {
      console.log(`\nUnknown theme: ${name}`);
      console.log(`Available: ${themes.join(', ')}\n`);
    }
  });

// Custom help
program.addHelpText('after', `

Examples:
  $ openedge compile kernel.dsl              Compile to kernel.csv
  $ openedge compile kernel.dsl -o out.csv   Compile to out.csv
  $ openedge check kernel.dsl                Validate without output
  $ openedge info kernel.dsl                 Show program statistics
  $ openedge info kernel.dsl --json          Output stats as JSON
  $ openedge watch kernel.dsl                Watch and auto-recompile
  $ openedge theme dracula                   Change to Dracula theme
  $ openedge interactive                     Launch interactive mode
  $ openedge i                               (shortcut for interactive)
  $ openedge tui                             Launch TUI mode (experimental)

Documentation:
  https://github.com/PhDCristian/OpenEdgeDSL
`);

// If no command provided, launch interactive mode
if (process.argv.length <= 2) {
  runInteractiveMode();
} else {
  program.parse();
}
