/**
 * Check command - validates DSL source without generating output
 */

import { Command } from 'commander';
import { compileDslToCsv } from '../../compiler.js';
import { logger } from '../utils/logger.js';
import { readFile, getRelativePath } from '../utils/files.js';

export const checkCommand = new Command('check')
  .description('Validate DSL source file without generating output')
  .argument('<file>', 'DSL source file to validate')
  .option('--no-color', 'Disable colored output')
  .action((file: string) => {
    // Read input file
    const readResult = readFile(file);
    if (!readResult.success) {
      logger.error(readResult.error!);
      process.exit(1);
    }
    
    // Compile (just to validate)
    const result = compileDslToCsv(readResult.content!);
    const relativePath = getRelativePath(file);
    
    if (result.success) {
      logger.success(`${relativePath}: No errors found`);
      
      // Show some basic info
      if (result.maxCycles) {
        logger.dim(`  ${result.maxCycles} cycles, ${result.memoryRegions?.length || 0} memory regions`);
      }
      logger.newline();
    } else {
      logger.error(`${relativePath}: Validation failed`);
      
      if (result.line && readResult.content) {
        logger.codeFrame(
          readResult.content,
          result.line,
          1,
          result.error || 'Unknown error',
          relativePath
        );
      } else {
        logger.newline();
        logger.dim(`  ${result.error}`);
        logger.newline();
      }
      
      process.exit(1);
    }
  });
