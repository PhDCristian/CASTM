/**
 * Compile command - compiles DSL source to CSV
 */

import { Command } from 'commander';
import { compileDslToCsv } from '../../compiler.js';
import { readFile, writeFile, getOutputPath, getRelativePath } from '../utils/files.js';
import { printSuccess, printCompilationStats, printErrorCard, printError } from '../ui/premium.js';

export const compileCommand = new Command('compile')
  .description('Compile DSL source file to CSV format')
  .argument('<file>', 'Input DSL source file')
  .option('-o, --output <file>', 'Output CSV file (default: <input>.csv)')
  .option('-q, --quiet', 'Suppress non-error output')
  .option('--no-color', 'Disable colored output')
  .action((file: string, options: {
    output?: string;
    quiet?: boolean;
    color?: boolean;
  }) => {
    const startTime = performance.now();
    
    // Read input file
    const readResult = readFile(file);
    if (!readResult.success) {
      printErrorCard({
        message: readResult.error || 'Failed to read file',
        file: getRelativePath(file),
      });
      process.exit(1);
    }
    
    // Compile
    const result = compileDslToCsv(readResult.content!);
    
    if (result.success) {
      // Write output
      const outputPath = getOutputPath(file, options.output);
      const writeResult = writeFile(outputPath, result.csv!);
      
      if (!writeResult.success) {
        printErrorCard({
          message: writeResult.error || 'Failed to write file',
          file: getRelativePath(outputPath),
        });
        process.exit(1);
      }
      
      // Success output
      if (!options.quiet) {
        const endTime = performance.now();
        
        printSuccess('Compiled successfully');
        printCompilationStats({
          output: getRelativePath(outputPath),
          cycles: result.maxCycles,
          grid: result.suggestedGridSize,
          memoryRegions: result.memoryRegions?.length || 0,
          assertions: result.assertions?.length || 0,
          time: endTime - startTime,
        });
      }
    } else {
      // Compilation error - use new error card
      printErrorCard({
        message: result.error || 'Compilation failed',
        file: getRelativePath(file),
        line: result.line,
        column: 1,
        source: readResult.content,
      });
      
      process.exit(1);
    }
  });
