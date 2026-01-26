/**
 * Info command - displays program statistics
 */

import { Command } from 'commander';
import { compileDslToCsv } from '../../compiler.js';
import { logger } from '../utils/logger.js';
import { readFile, getRelativePath } from '../utils/files.js';

interface ProgramInfo {
  file: string;
  valid: boolean;
  cycles?: number;
  grid?: {
    width: number;
    height: number;
  };
  memoryRegions?: {
    count: number;
    regions: Array<{
      name?: string;
      start: number;
      size: number;
    }>;
  };
  assertions?: number;
  error?: string;
  errorLine?: number;
}

export const infoCommand = new Command('info')
  .description('Display program statistics and information')
  .argument('<file>', 'DSL source file')
  .option('--json', 'Output as JSON')
  .option('--no-color', 'Disable colored output')
  .action((file: string, options: { json?: boolean }) => {
    // Read input file
    const readResult = readFile(file);
    if (!readResult.success) {
      if (options.json) {
        console.log(JSON.stringify({ error: readResult.error }, null, 2));
      } else {
        logger.error(readResult.error!);
      }
      process.exit(1);
    }
    
    // Compile to get info
    const result = compileDslToCsv(readResult.content!);
    const relativePath = getRelativePath(file);
    
    const info: ProgramInfo = {
      file: relativePath,
      valid: result.success,
    };
    
    if (result.success) {
      info.cycles = result.maxCycles;
      info.grid = result.suggestedGridSize;
      info.assertions = result.assertions?.length || 0;
      
      if (result.memoryRegions && result.memoryRegions.length > 0) {
        info.memoryRegions = {
          count: result.memoryRegions.length,
          regions: result.memoryRegions.map(r => ({
            name: r.name,
            start: r.start,
            size: r.values.length,
          })),
        };
      }
    } else {
      info.error = result.error;
      info.errorLine = result.line;
    }
    
    if (options.json) {
      console.log(JSON.stringify(info, null, 2));
    } else {
      logger.newline();
      
      if (info.valid) {
        logger.success(`Program: ${relativePath}`);
        logger.newline();
        
        logger.property('Status', 'Valid');
        
        if (info.cycles !== undefined) {
          logger.property('Cycles', info.cycles);
        }
        
        if (info.grid) {
          logger.property('Grid', `${info.grid.width}\u00D7${info.grid.height}`);
        }
        
        if (info.memoryRegions) {
          logger.property('Memory', `${info.memoryRegions.count} region(s)`);
          
          for (const region of info.memoryRegions.regions) {
            const name = region.name || '(anonymous)';
            logger.dim(`      ${name}: 0x${region.start.toString(16)} (${region.size} values)`);
          }
        }
        
        if (info.assertions && info.assertions > 0) {
          logger.property('Assertions', info.assertions);
        }
        
        logger.newline();
      } else {
        logger.error(`Program: ${relativePath}`);
        logger.newline();
        logger.property('Status', 'Invalid');
        logger.property('Error', info.error || 'Unknown error');
        if (info.errorLine) {
          logger.property('Line', info.errorLine);
        }
        logger.newline();
        process.exit(1);
      }
    }
  });
