/**
 * Batch compilation command - compile multiple DSL files with parallel processing
 * 
 * Features:
 * - Glob pattern support (*.dsl, **\/*.dsl)
 * - Parallel compilation with worker pool
 * - Multiple output formats (summary, JSON, markdown)
 * - Fail-fast and continue-on-error modes
 */

import { Command } from 'commander';
import { glob } from 'glob';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { compileDslToCsv } from '../../compiler.js';
import { readFile, writeFile, getRelativePath } from '../utils/files.js';
import { 
  createSpinner, 
  printSuccess, 
  printError, 
  printInfoPanel,
  getStatusBadge,
} from '../ui/premium.js';
import { getCurrentTheme } from '../config/store.js';
import chalk from 'chalk';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface CompilationResult {
  file: string;
  output: string;
  success: boolean;
  error?: string;
  line?: number;
  time: number;
  metrics?: {
    cycles: number;
    gridSize: string;
    memoryRegions: number;
    assertions: number;
  };
}

interface BatchResult {
  files: CompilationResult[];
  totalTime: number;
  successCount: number;
  failureCount: number;
  totalCycles: number;
}

interface BatchOptions {
  output?: string;
  parallel?: number;
  format?: 'summary' | 'json' | 'markdown';
  failFast?: boolean;
  continue?: boolean;
  exclude?: string[];
  quiet?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// FILE DISCOVERY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Discover files matching glob patterns
 */
async function discoverFiles(patterns: string[], excludePatterns: string[] = []): Promise<string[]> {
  const allFiles = new Set<string>();
  
  for (const pattern of patterns) {
    const matches = await glob(pattern, { 
      nodir: true,
      ignore: excludePatterns,
    });
    matches.forEach(f => allFiles.add(path.resolve(f)));
  }
  
  // Sort alphabetically for deterministic order
  return Array.from(allFiles).sort();
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPILATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Compile a single file
 */
function compileFile(filePath: string, outputDir?: string): CompilationResult {
  const startTime = performance.now();
  
  // Determine output path
  let outputPath: string;
  if (outputDir) {
    const relativePath = path.relative(process.cwd(), filePath);
    const outputName = relativePath.replace(/\.dsl$/i, '.csv');
    outputPath = path.join(outputDir, outputName);
  } else {
    outputPath = filePath.replace(/\.dsl$/i, '.csv');
  }
  
  // Read input file
  const readResult = readFile(filePath);
  if (!readResult.success) {
    return {
      file: filePath,
      output: outputPath,
      success: false,
      error: readResult.error || 'Failed to read file',
      time: performance.now() - startTime,
    };
  }
  
  // Compile
  const result = compileDslToCsv(readResult.content!);
  
  if (!result.success) {
    return {
      file: filePath,
      output: outputPath,
      success: false,
      error: result.error || 'Compilation failed',
      line: result.line,
      time: performance.now() - startTime,
    };
  }
  
  // Ensure output directory exists
  const outDir = path.dirname(outputPath);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  
  // Write output
  const writeResult = writeFile(outputPath, result.csv!);
  if (!writeResult.success) {
    return {
      file: filePath,
      output: outputPath,
      success: false,
      error: writeResult.error || 'Failed to write output',
      time: performance.now() - startTime,
    };
  }
  
  return {
    file: filePath,
    output: outputPath,
    success: true,
    time: performance.now() - startTime,
    metrics: {
      cycles: result.maxCycles,
      gridSize: result.suggestedGridSize,
      memoryRegions: result.memoryRegions?.length || 0,
      assertions: result.assertions?.length || 0,
    },
  };
}

/**
 * Compile files in parallel using a simple pool
 */
async function compileFilesParallel(
  files: string[], 
  options: BatchOptions,
  onProgress?: (completed: number, total: number, result: CompilationResult) => void
): Promise<BatchResult> {
  const startTime = performance.now();
  const results: CompilationResult[] = [];
  const concurrency = options.parallel || Math.max(1, os.cpus().length - 1);
  
  let successCount = 0;
  let failureCount = 0;
  let totalCycles = 0;
  let stopped = false;
  
  // Process files in batches
  for (let i = 0; i < files.length && !stopped; i += concurrency) {
    const batch = files.slice(i, i + concurrency);
    
    // Compile batch in parallel
    const batchPromises = batch.map(async (file) => {
      if (stopped) return null;
      
      const result = compileFile(file, options.output);
      return result;
    });
    
    const batchResults = await Promise.all(batchPromises);
    
    for (const result of batchResults) {
      if (result === null || stopped) continue;
      
      results.push(result);
      
      if (result.success) {
        successCount++;
        totalCycles += result.metrics?.cycles || 0;
      } else {
        failureCount++;
        
        // Fail-fast mode
        if (options.failFast) {
          stopped = true;
        }
      }
      
      if (onProgress) {
        onProgress(results.length, files.length, result);
      }
    }
  }
  
  return {
    files: results,
    totalTime: performance.now() - startTime,
    successCount,
    failureCount,
    totalCycles,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// REPORTING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Format time in a human-readable way
 */
function formatTime(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Print summary report (default)
 */
function printSummaryReport(result: BatchResult): void {
  const theme = getCurrentTheme();
  
  console.log();
  console.log(chalk.hex(theme.primary).bold('  Batch Compilation Results'));
  console.log(chalk.hex(theme.dim)('  ' + '─'.repeat(40)));
  console.log();
  
  // Per-file results (abbreviated if many)
  const maxDisplay = 20;
  const displayFiles = result.files.slice(0, maxDisplay);
  
  for (const file of displayFiles) {
    const relativePath = getRelativePath(file.file);
    const status = file.success ? chalk.hex(theme.success)('+') : chalk.hex(theme.error)('x');
    const timeStr = chalk.hex(theme.dim)(`(${formatTime(file.time)})`);
    
    if (file.success) {
      const cycles = file.metrics?.cycles !== undefined 
        ? chalk.hex(theme.accent)(`${file.metrics.cycles} cycles`) 
        : '';
      console.log(`  ${status} ${relativePath} ${timeStr} ${cycles}`);
    } else {
      const error = chalk.hex(theme.error)(file.error || 'Unknown error');
      console.log(`  ${status} ${relativePath} ${timeStr}`);
      console.log(`    ${error}`);
    }
  }
  
  if (result.files.length > maxDisplay) {
    console.log(chalk.hex(theme.dim)(`  ... and ${result.files.length - maxDisplay} more files`));
  }
  
  console.log();
  console.log(chalk.hex(theme.dim)('  ' + '─'.repeat(40)));
  
  // Summary
  const successRate = ((result.successCount / result.files.length) * 100).toFixed(1);
  
  console.log();
  console.log(`  ${chalk.hex(theme.dim)('Files:')}       ${result.files.length}`);
  console.log(`  ${chalk.hex(theme.dim)('Succeeded:')}   ${chalk.hex(theme.success)(result.successCount.toString())}`);
  console.log(`  ${chalk.hex(theme.dim)('Failed:')}      ${chalk.hex(result.failureCount > 0 ? theme.error : theme.success)(result.failureCount.toString())}`);
  console.log(`  ${chalk.hex(theme.dim)('Success rate:')} ${successRate}%`);
  console.log(`  ${chalk.hex(theme.dim)('Total cycles:')} ${result.totalCycles}`);
  console.log(`  ${chalk.hex(theme.dim)('Total time:')}  ${formatTime(result.totalTime)}`);
  console.log();
  
  // Final status
  if (result.failureCount === 0) {
    printSuccess('All files compiled successfully');
  } else {
    printError(`${result.failureCount} file(s) failed to compile`);
  }
}

/**
 * Generate JSON report
 */
function generateJsonReport(result: BatchResult): string {
  return JSON.stringify({
    summary: {
      totalFiles: result.files.length,
      successCount: result.successCount,
      failureCount: result.failureCount,
      successRate: (result.successCount / result.files.length) * 100,
      totalCycles: result.totalCycles,
      totalTimeMs: result.totalTime,
    },
    files: result.files.map(f => ({
      input: getRelativePath(f.file),
      output: getRelativePath(f.output),
      success: f.success,
      error: f.error,
      line: f.line,
      timeMs: f.time,
      metrics: f.metrics,
    })),
  }, null, 2);
}

/**
 * Generate Markdown report
 */
function generateMarkdownReport(result: BatchResult): string {
  const successRate = ((result.successCount / result.files.length) * 100).toFixed(1);
  
  let md = `# Batch Compilation Report\n\n`;
  md += `## Summary\n\n`;
  md += `| Metric | Value |\n`;
  md += `|--------|-------|\n`;
  md += `| Total Files | ${result.files.length} |\n`;
  md += `| Succeeded | ${result.successCount} |\n`;
  md += `| Failed | ${result.failureCount} |\n`;
  md += `| Success Rate | ${successRate}% |\n`;
  md += `| Total Cycles | ${result.totalCycles} |\n`;
  md += `| Total Time | ${formatTime(result.totalTime)} |\n\n`;
  
  md += `## Files\n\n`;
  md += `| File | Status | Cycles | Time |\n`;
  md += `|------|--------|--------|------|\n`;
  
  for (const file of result.files) {
    const status = file.success ? '✅' : '❌';
    const cycles = file.metrics?.cycles ?? '-';
    const time = formatTime(file.time);
    md += `| ${getRelativePath(file.file)} | ${status} | ${cycles} | ${time} |\n`;
  }
  
  if (result.failureCount > 0) {
    md += `\n## Errors\n\n`;
    for (const file of result.files.filter(f => !f.success)) {
      md += `### ${getRelativePath(file.file)}\n\n`;
      md += `- **Error:** ${file.error}\n`;
      if (file.line) {
        md += `- **Line:** ${file.line}\n`;
      }
      md += `\n`;
    }
  }
  
  return md;
}

// ═══════════════════════════════════════════════════════════════════════════
// COMMAND
// ═══════════════════════════════════════════════════════════════════════════

export const batchCommand = new Command('batch')
  .description('Compile multiple DSL files with parallel processing')
  .argument('<patterns...>', 'Glob patterns for input files (e.g., "**/*.dsl")')
  .option('-o, --output <dir>', 'Output directory for CSV files')
  .option('-p, --parallel <n>', 'Number of parallel workers (default: CPU count - 1)', parseInt)
  .option('-f, --format <fmt>', 'Output format: summary, json, markdown', 'summary')
  .option('--fail-fast', 'Stop on first compilation error')
  .option('-c, --continue', 'Continue on errors (default behavior)')
  .option('-e, --exclude <patterns...>', 'Exclude patterns')
  .option('-q, --quiet', 'Suppress progress output')
  .option('--json-file <file>', 'Write JSON report to file')
  .option('--markdown-file <file>', 'Write Markdown report to file')
  .action(async (patterns: string[], options: BatchOptions & { jsonFile?: string; markdownFile?: string }) => {
    const theme = getCurrentTheme();
    
    // Discover files
    const spinner = createSpinner('Discovering files...');
    spinner.start();
    
    const excludePatterns = options.exclude || [];
    const files = await discoverFiles(patterns, excludePatterns);
    
    if (files.length === 0) {
      spinner.fail('No files found matching patterns');
      console.log(chalk.hex(theme.dim)(`  Patterns: ${patterns.join(', ')}`));
      process.exit(1);
    }
    
    spinner.succeed(`Found ${files.length} file(s)`);
    
    // Compile files
    const compileSpinner = createSpinner(`Compiling ${files.length} files...`);
    if (!options.quiet) {
      compileSpinner.start();
    }
    
    let lastProgress = 0;
    const result = await compileFilesParallel(files, options, (completed, total, _res) => {
      // Update progress every 5% or every file for small batches
      const progress = Math.floor((completed / total) * 100);
      if (!options.quiet && (progress >= lastProgress + 5 || total <= 10)) {
        compileSpinner.text = `Compiling... ${completed}/${total} (${progress}%)`;
        lastProgress = progress;
      }
    });
    
    if (!options.quiet) {
      if (result.failureCount === 0) {
        compileSpinner.succeed(`Compiled ${result.successCount} file(s)`);
      } else {
        compileSpinner.warn(`Compiled ${result.successCount}/${files.length} file(s)`);
      }
    }
    
    // Output report based on format
    if (options.format === 'json') {
      console.log(generateJsonReport(result));
    } else if (options.format === 'markdown') {
      console.log(generateMarkdownReport(result));
    } else {
      printSummaryReport(result);
    }
    
    // Write report files if requested
    if (options.jsonFile) {
      fs.writeFileSync(options.jsonFile, generateJsonReport(result));
      console.log(chalk.hex(theme.dim)(`  JSON report written to: ${options.jsonFile}`));
    }
    
    if (options.markdownFile) {
      fs.writeFileSync(options.markdownFile, generateMarkdownReport(result));
      console.log(chalk.hex(theme.dim)(`  Markdown report written to: ${options.markdownFile}`));
    }
    
    // Exit with error code if any failures
    if (result.failureCount > 0) {
      process.exit(1);
    }
  });
