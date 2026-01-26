/**
 * Check command - validates DSL source without generating output
 */

import { Command } from 'commander';
import { compileDslToCsv } from '../../compiler.js';
import { readFile, getRelativePath } from '../utils/files.js';
import { printSuccess, printErrorCard, chalk, getCurrentTheme } from '../ui/premium.js';
import { getCurrentTheme as getTheme } from '../config/store.js';

export const checkCommand = new Command('check')
  .description('Validate DSL source file without generating output')
  .argument('<file>', 'DSL source file to validate')
  .option('--no-color', 'Disable colored output')
  .action((file: string) => {
    const theme = getTheme();
    
    // Read input file
    const readResult = readFile(file);
    if (!readResult.success) {
      printErrorCard({
        message: readResult.error || 'Failed to read file',
        file: getRelativePath(file),
      });
      process.exit(1);
    }
    
    // Compile (just to validate)
    const result = compileDslToCsv(readResult.content!);
    const relativePath = getRelativePath(file);
    
    if (result.success) {
      printSuccess(`${relativePath}: No errors found`);
      
      // Show some basic info
      if (result.maxCycles) {
        console.log(chalk.hex(theme.dim)(`    ${result.maxCycles} cycles, ${result.memoryRegions?.length || 0} memory regions`));
      }
      console.log();
    } else {
      // Use new error card
      printErrorCard({
        message: result.error || 'Validation failed',
        file: relativePath,
        line: result.line,
        column: 1,
        source: readResult.content,
      });
      
      process.exit(1);
    }
  });
