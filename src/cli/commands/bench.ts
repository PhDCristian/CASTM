/**
 * Benchmarking & Regression Testing Command
 * 
 * Features:
 * - Save/load baselines for comparison
 * - Compile directory and collect metrics
 * - Compare against baseline and detect regressions
 * - Threshold-based pass/fail for CI/CD integration
 * - Multiple output formats (table, JSON, markdown)
 */

import { Command } from 'commander';
import { glob } from 'glob';
import * as path from 'path';
import * as fs from 'fs';
import { compileDslToCsv } from '../../compiler.js';
import { readFile } from '../utils/files.js';
import { 
  createSpinner, 
  printSuccess, 
  printError, 
  printWarning,
  printInfoPanel,
} from '../ui/premium.js';
import { getCurrentTheme } from '../config/store.js';
import chalk from 'chalk';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface FileMetrics {
  file: string;
  cycles: number;
  gridWidth: number;
  gridHeight: number;
  memoryRegions: number;
  peUtilization: number;  // Percentage of PE grid used
  success: boolean;
  error?: string;
}

interface Baseline {
  version: string;
  timestamp: string;
  cliVersion: string;
  files: FileMetrics[];
  summary: {
    totalFiles: number;
    totalCycles: number;
    avgPeUtilization: number;
  };
}

interface ComparisonResult {
  file: string;
  current: FileMetrics;
  baseline?: FileMetrics;
  delta: {
    cycles: number;
    cyclesPercent: number;
    peUtilization: number;
  };
  status: 'improved' | 'stable' | 'regressed' | 'new' | 'removed' | 'error';
}

interface BenchResult {
  comparisons: ComparisonResult[];
  summary: {
    total: number;
    improved: number;
    stable: number;
    regressed: number;
    newFiles: number;
    errors: number;
    passed: boolean;
  };
  threshold?: number;
}

interface BenchOptions {
  save?: string;
  baseline?: string;
  threshold?: string;
  format?: 'table' | 'json' | 'markdown';
  sort?: 'name' | 'cycles' | 'delta';
  quiet?: boolean;
}

const CLI_VERSION = '0.1.0';

// ═══════════════════════════════════════════════════════════════════════════
// FILE DISCOVERY
// ═══════════════════════════════════════════════════════════════════════════

async function discoverDslFiles(dir: string): Promise<string[]> {
  const pattern = path.join(dir, '**/*.dsl');
  const files = await glob(pattern, { nodir: true });
  return files.map(f => path.resolve(f)).sort();
}

// ═══════════════════════════════════════════════════════════════════════════
// METRICS COLLECTION
// ═══════════════════════════════════════════════════════════════════════════

function collectMetrics(filePath: string): FileMetrics {
  const readResult = readFile(filePath);
  
  if (!readResult.success) {
    return {
      file: path.relative(process.cwd(), filePath),
      cycles: 0,
      gridWidth: 0,
      gridHeight: 0,
      memoryRegions: 0,
      peUtilization: 0,
      success: false,
      error: readResult.error,
    };
  }
  
  const result = compileDslToCsv(readResult.content!);
  const relativePath = path.relative(process.cwd(), filePath);
  
  if (!result.success) {
    return {
      file: relativePath,
      cycles: 0,
      gridWidth: 0,
      gridHeight: 0,
      memoryRegions: 0,
      peUtilization: 0,
      success: false,
      error: result.error,
    };
  }
  
  // Calculate PE utilization from CSV output
  // Parse CSV to count unique PEs used
  const usedPEs = new Set<string>();
  if (result.csv) {
    const lines = result.csv.split('\n').slice(1); // Skip header
    for (const line of lines) {
      const cols = line.split(',');
      if (cols.length >= 2) {
        usedPEs.add(`${cols[0]},${cols[1]}`); // row,col
      }
    }
  }
  
  const gridWidth = result.suggestedGridSize?.width || 4;
  const gridHeight = result.suggestedGridSize?.height || 4;
  const totalPEs = gridWidth * gridHeight;
  const peUtilization = (usedPEs.size / totalPEs) * 100;
  
  return {
    file: relativePath,
    cycles: result.maxCycles || 0,
    gridWidth,
    gridHeight,
    memoryRegions: result.memoryRegions?.length || 0,
    peUtilization: Math.round(peUtilization * 10) / 10,
    success: true,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// BASELINE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

function createBaseline(files: FileMetrics[]): Baseline {
  const successfulFiles = files.filter(f => f.success);
  const totalCycles = successfulFiles.reduce((sum, f) => sum + f.cycles, 0);
  const avgPeUtilization = successfulFiles.length > 0
    ? successfulFiles.reduce((sum, f) => sum + f.peUtilization, 0) / successfulFiles.length
    : 0;
  
  return {
    version: '1.0',
    timestamp: new Date().toISOString(),
    cliVersion: CLI_VERSION,
    files,
    summary: {
      totalFiles: files.length,
      totalCycles,
      avgPeUtilization: Math.round(avgPeUtilization * 10) / 10,
    },
  };
}

function saveBaseline(baseline: Baseline, filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(baseline, null, 2));
}

function loadBaseline(filePath: string): Baseline | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const baseline = JSON.parse(content) as Baseline;
    
    // Validate
    if (!baseline.version || !baseline.files) {
      throw new Error('Invalid baseline format');
    }
    
    return baseline;
  } catch (e: any) {
    throw new Error(`Failed to load baseline: ${e.message}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPARISON
// ═══════════════════════════════════════════════════════════════════════════

function compareMetrics(
  current: FileMetrics[], 
  baseline: Baseline | null,
  thresholdPercent: number
): BenchResult {
  const comparisons: ComparisonResult[] = [];
  const baselineMap = new Map<string, FileMetrics>();
  
  if (baseline) {
    baseline.files.forEach(f => baselineMap.set(f.file, f));
  }
  
  // Compare current files against baseline
  for (const curr of current) {
    const base = baselineMap.get(curr.file);
    
    if (!curr.success) {
      comparisons.push({
        file: curr.file,
        current: curr,
        baseline: base,
        delta: { cycles: 0, cyclesPercent: 0, peUtilization: 0 },
        status: 'error',
      });
      continue;
    }
    
    if (!base) {
      comparisons.push({
        file: curr.file,
        current: curr,
        delta: { cycles: 0, cyclesPercent: 0, peUtilization: 0 },
        status: 'new',
      });
      continue;
    }
    
    const cyclesDelta = curr.cycles - base.cycles;
    const cyclesPercent = base.cycles > 0 ? (cyclesDelta / base.cycles) * 100 : 0;
    const peUtilDelta = curr.peUtilization - base.peUtilization;
    
    let status: ComparisonResult['status'];
    if (cyclesPercent > thresholdPercent) {
      status = 'regressed';  // More cycles = regression
    } else if (cyclesPercent < -thresholdPercent) {
      status = 'improved';   // Fewer cycles = improvement
    } else {
      status = 'stable';
    }
    
    comparisons.push({
      file: curr.file,
      current: curr,
      baseline: base,
      delta: {
        cycles: cyclesDelta,
        cyclesPercent: Math.round(cyclesPercent * 10) / 10,
        peUtilization: Math.round(peUtilDelta * 10) / 10,
      },
      status,
    });
    
    baselineMap.delete(curr.file);
  }
  
  // Files in baseline but not in current (removed)
  for (const [file, base] of baselineMap) {
    comparisons.push({
      file,
      current: { ...base, success: false, error: 'File removed' },
      baseline: base,
      delta: { cycles: 0, cyclesPercent: 0, peUtilization: 0 },
      status: 'removed',
    });
  }
  
  // Calculate summary
  const improved = comparisons.filter(c => c.status === 'improved').length;
  const stable = comparisons.filter(c => c.status === 'stable').length;
  const regressed = comparisons.filter(c => c.status === 'regressed').length;
  const newFiles = comparisons.filter(c => c.status === 'new').length;
  const errors = comparisons.filter(c => c.status === 'error').length;
  
  return {
    comparisons,
    summary: {
      total: comparisons.length,
      improved,
      stable,
      regressed,
      newFiles,
      errors,
      passed: regressed === 0,
    },
    threshold: thresholdPercent,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// OUTPUT FORMATTERS
// ═══════════════════════════════════════════════════════════════════════════

function formatTable(result: BenchResult): string {
  const theme = getCurrentTheme();
  const lines: string[] = [];
  
  // Header
  lines.push('');
  lines.push(chalk.hex(theme.primary).bold('  Benchmark Results'));
  lines.push(chalk.hex(theme.dim)('  ' + '─'.repeat(70)));
  lines.push('');
  
  // Column headers
  const header = '  ' + 
    'File'.padEnd(40) + 
    'Cycles'.padStart(8) + 
    'Delta'.padStart(10) + 
    'Status'.padStart(12);
  lines.push(chalk.hex(theme.dim)(header));
  lines.push(chalk.hex(theme.dim)('  ' + '─'.repeat(70)));
  
  // Sort by file name
  const sorted = [...result.comparisons].sort((a, b) => a.file.localeCompare(b.file));
  
  for (const comp of sorted) {
    const fileName = comp.file.length > 38 ? '...' + comp.file.slice(-35) : comp.file;
    const cycles = comp.current.success ? comp.current.cycles.toString() : '-';
    
    let deltaStr = '';
    let statusStr = '';
    let statusColor = theme.dim;
    
    switch (comp.status) {
      case 'improved':
        deltaStr = `↓${Math.abs(comp.delta.cyclesPercent)}%`;
        statusStr = '✓ improved';
        statusColor = theme.success;
        break;
      case 'stable':
        deltaStr = '=';
        statusStr = '● stable';
        statusColor = theme.dim;
        break;
      case 'regressed':
        deltaStr = `↑${comp.delta.cyclesPercent}%`;
        statusStr = '✗ regressed';
        statusColor = theme.error;
        break;
      case 'new':
        deltaStr = 'new';
        statusStr = '+ new';
        statusColor = theme.accent;
        break;
      case 'error':
        deltaStr = '-';
        statusStr = '! error';
        statusColor = theme.error;
        break;
      case 'removed':
        deltaStr = '-';
        statusStr = '- removed';
        statusColor = theme.warning;
        break;
    }
    
    const line = '  ' + 
      fileName.padEnd(40) + 
      cycles.padStart(8) + 
      chalk.hex(statusColor)(deltaStr.padStart(10)) + 
      chalk.hex(statusColor)(statusStr.padStart(12));
    
    lines.push(line);
  }
  
  // Summary
  lines.push(chalk.hex(theme.dim)('  ' + '─'.repeat(70)));
  lines.push('');
  
  const { improved, stable, regressed, newFiles, errors, passed } = result.summary;
  
  const summaryParts = [];
  if (improved > 0) summaryParts.push(chalk.hex(theme.success)(`${improved} improved`));
  if (stable > 0) summaryParts.push(chalk.hex(theme.dim)(`${stable} stable`));
  if (regressed > 0) summaryParts.push(chalk.hex(theme.error)(`${regressed} regressed`));
  if (newFiles > 0) summaryParts.push(chalk.hex(theme.accent)(`${newFiles} new`));
  if (errors > 0) summaryParts.push(chalk.hex(theme.error)(`${errors} errors`));
  
  lines.push('  ' + summaryParts.join(chalk.hex(theme.dim)(' · ')));
  
  if (result.threshold !== undefined) {
    const thresholdStr = `  Threshold: ${result.threshold}%`;
    const passedStr = passed 
      ? chalk.hex(theme.success).bold('  ✓ PASSED')
      : chalk.hex(theme.error).bold('  ✗ FAILED');
    lines.push('');
    lines.push(chalk.hex(theme.dim)(thresholdStr) + passedStr);
  }
  
  lines.push('');
  
  return lines.join('\n');
}

function formatJson(result: BenchResult, baseline: Baseline | null, current: FileMetrics[]): string {
  return JSON.stringify({
    timestamp: new Date().toISOString(),
    threshold: result.threshold,
    passed: result.summary.passed,
    summary: result.summary,
    comparisons: result.comparisons.map(c => ({
      file: c.file,
      status: c.status,
      current: c.current.success ? {
        cycles: c.current.cycles,
        peUtilization: c.current.peUtilization,
        gridSize: `${c.current.gridWidth}x${c.current.gridHeight}`,
      } : { error: c.current.error },
      baseline: c.baseline ? {
        cycles: c.baseline.cycles,
        peUtilization: c.baseline.peUtilization,
      } : null,
      delta: c.delta,
    })),
  }, null, 2);
}

function formatMarkdown(result: BenchResult): string {
  const lines: string[] = [];
  
  lines.push('# Benchmark Results');
  lines.push('');
  lines.push(`**Date:** ${new Date().toISOString()}`);
  if (result.threshold !== undefined) {
    lines.push(`**Threshold:** ${result.threshold}%`);
    lines.push(`**Status:** ${result.summary.passed ? '✅ PASSED' : '❌ FAILED'}`);
  }
  lines.push('');
  
  // Table
  lines.push('| File | Cycles | Delta | Status |');
  lines.push('|------|--------|-------|--------|');
  
  for (const comp of result.comparisons) {
    const cycles = comp.current.success ? comp.current.cycles.toString() : '-';
    let delta = '';
    let status = '';
    
    switch (comp.status) {
      case 'improved': delta = `↓${Math.abs(comp.delta.cyclesPercent)}%`; status = '✅ improved'; break;
      case 'stable': delta = '='; status = '⚪ stable'; break;
      case 'regressed': delta = `↑${comp.delta.cyclesPercent}%`; status = '❌ regressed'; break;
      case 'new': delta = 'new'; status = '🆕 new'; break;
      case 'error': delta = '-'; status = '⚠️ error'; break;
      case 'removed': delta = '-'; status = '➖ removed'; break;
    }
    
    lines.push(`| ${comp.file} | ${cycles} | ${delta} | ${status} |`);
  }
  
  lines.push('');
  
  // Summary
  const { improved, stable, regressed, newFiles, errors } = result.summary;
  lines.push('## Summary');
  lines.push('');
  lines.push(`- **Improved:** ${improved}`);
  lines.push(`- **Stable:** ${stable}`);
  lines.push(`- **Regressed:** ${regressed}`);
  lines.push(`- **New:** ${newFiles}`);
  lines.push(`- **Errors:** ${errors}`);
  lines.push('');
  
  return lines.join('\n');
}

// ═══════════════════════════════════════════════════════════════════════════
// COMMAND
// ═══════════════════════════════════════════════════════════════════════════

export const benchCommand = new Command('bench')
  .description('Benchmark DSL files and compare against baseline')
  .argument('<dir>', 'Directory containing DSL files')
  .option('-s, --save <file>', 'Save current metrics as baseline')
  .option('-b, --baseline <file>', 'Compare against baseline file')
  .option('-t, --threshold <percent>', 'Regression threshold percentage (default: 5)', '5')
  .option('-f, --format <format>', 'Output format: table, json, markdown', 'table')
  .option('--sort <by>', 'Sort by: name, cycles, delta', 'name')
  .option('-q, --quiet', 'Minimal output')
  .action(async (dir: string, options: BenchOptions) => {
    const theme = getCurrentTheme();
    const thresholdPercent = parseFloat(options.threshold || '5');
    
    // Validate directory
    if (!fs.existsSync(dir)) {
      printError(`Directory not found: ${dir}`);
      process.exit(1);
    }
    
    // Discover files
    const spinner = createSpinner('Discovering DSL files...');
    spinner.start();
    
    const files = await discoverDslFiles(dir);
    
    if (files.length === 0) {
      spinner.fail('No DSL files found');
      process.exit(1);
    }
    
    spinner.succeed(`Found ${files.length} DSL files`);
    
    // Collect metrics
    const metricsSpinner = createSpinner('Collecting metrics...');
    metricsSpinner.start();
    
    const metrics: FileMetrics[] = [];
    for (const file of files) {
      const m = collectMetrics(file);
      metrics.push(m);
    }
    
    const successCount = metrics.filter(m => m.success).length;
    const failCount = metrics.filter(m => !m.success).length;
    
    if (failCount > 0) {
      metricsSpinner.warn(`Collected ${successCount} metrics (${failCount} errors)`);
    } else {
      metricsSpinner.succeed(`Collected ${successCount} metrics`);
    }
    
    // Save baseline if requested
    if (options.save) {
      const baseline = createBaseline(metrics);
      const savePath = path.resolve(options.save);
      saveBaseline(baseline, savePath);
      printSuccess(`Baseline saved to ${options.save}`);
      
      if (!options.baseline) {
        // Just saving, no comparison
        if (!options.quiet) {
          console.log('');
          console.log(chalk.hex(theme.dim)('  Summary:'));
          console.log(chalk.hex(theme.dim)(`    Files: ${baseline.summary.totalFiles}`));
          console.log(chalk.hex(theme.dim)(`    Total cycles: ${baseline.summary.totalCycles}`));
          console.log(chalk.hex(theme.dim)(`    Avg PE utilization: ${baseline.summary.avgPeUtilization}%`));
          console.log('');
        }
        return;
      }
    }
    
    // Load baseline for comparison
    let baseline: Baseline | null = null;
    if (options.baseline) {
      try {
        baseline = loadBaseline(options.baseline);
        if (!baseline) {
          printWarning(`Baseline not found: ${options.baseline}`);
        }
      } catch (e: any) {
        printError(e.message);
        process.exit(1);
      }
    }
    
    // Compare
    const result = compareMetrics(metrics, baseline, thresholdPercent);
    
    // Output
    switch (options.format) {
      case 'json':
        console.log(formatJson(result, baseline, metrics));
        break;
      case 'markdown':
        console.log(formatMarkdown(result));
        break;
      default:
        console.log(formatTable(result));
    }
    
    // Exit code based on pass/fail
    if (options.baseline && !result.summary.passed) {
      process.exit(1);
    }
  });
