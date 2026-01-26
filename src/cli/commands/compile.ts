/**
 * Compile command - compiles DSL source to CSV
 */

import { Command } from 'commander';
import { compileDslToCsv } from '../../compiler.js';
import { logger } from '../utils/logger.js';
import { readFile, writeFile, getOutputPath, getRelativePath } from '../utils/files.js';

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
      logger.error(readResult.error!);
      process.exit(1);
    }
    
    // Compile
    const result = compileDslToCsv(readResult.content!);
    
    if (result.success) {
      // Write output
      const outputPath = getOutputPath(file, options.output);
      const writeResult = writeFile(outputPath, result.csv!);
      
      if (!writeResult.success) {
        logger.error(writeResult.error!);
        process.exit(1);
      }
      
      // Success output
      if (!options.quiet) {
        const endTime = performance.now();
        
        logger.success('Compiled successfully');
        logger.stats({
          output: getRelativePath(outputPath),
          cycles: result.maxCycles,
          grid: result.suggestedGridSize,
          memoryRegions: result.memoryRegions?.length || 0,
          assertions: result.assertions?.length || 0,
          time: endTime - startTime,
        });
      }
    } else {
      // Compilation error
      logger.error('Compilation failed');
      
      if (result.line && readResult.content) {
        logger.codeFrame(
          readResult.content,
          result.line,
          1, // Column not always available
          result.error || 'Unknown error',
          getRelativePath(file)
        );
      } else {
        logger.newline();
        logger.dim(`  ${result.error}`);
        logger.newline();
      }
      
      process.exit(1);
    }
  });
