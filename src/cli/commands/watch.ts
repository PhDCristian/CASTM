/**
 * Enhanced Watch Mode - auto-recompilation with diff and metrics
 */

import { watch, existsSync } from 'fs';
import { basename, dirname } from 'path';
import { exec } from 'child_process';
import { compileDslToCsv } from '../../compiler.js';
import { readFile, writeFile, getOutputPath, getRelativePath } from '../utils/files.js';
import { diffCsv, formatDiff, formatDiffSummary, DiffResult } from '../utils/csv-diff.js';
import { 
  CompileMetrics, 
  MetricsDelta, 
  calculateMetricsDelta, 
  formatMetrics, 
  extractMetrics 
} from '../utils/metrics.js';
import {
  printCompilationStats,
  printCodeFrame,
  printWatchStatusBar,
  printWatchSummary,
  createSpinner,
  chalk,
  WatchStats,
} from '../ui/premium.js';
import { loadConfig, getCurrentTheme } from '../config/store.js';

export interface WatchOptions {
  output?: string;
  diff?: boolean;
  metrics?: boolean;
  clear?: boolean;
  notify?: boolean;
  exec?: string;
}

interface WatchState {
  isCompiling: boolean;
  lastCompileTime: number;
  stats: WatchStats;
  previousCsv: string | null;
  previousMetrics: CompileMetrics | null;
}

/**
 * Start watching a file for changes
 */
export async function startWatchMode(
  filePath: string,
  outputPath?: string,
  options: WatchOptions = {}
): Promise<void> {
  const config = loadConfig();
  const resolvedOutput = outputPath || getOutputPath(filePath);
  
  const state: WatchState = {
    isCompiling: false,
    lastCompileTime: 0,
    stats: {
      compiles: 0,
      errors: 0,
      startTime: Date.now(),
      lastStatus: 'ok',
    },
    previousCsv: null,
    previousMetrics: null,
  };
  
  // Initial compile
  if (options.clear !== false) {
    console.clear();
  }
  printWatchHeader(filePath, resolvedOutput, options);
  await compileFile(filePath, resolvedOutput, state, options);
  
  // Watch for changes
  const watcher = watch(filePath, { persistent: true }, async (eventType) => {
    if (eventType !== 'change') return;
    
    const now = Date.now();
    if (now - state.lastCompileTime < config.watchDebounceMs) return;
    if (state.isCompiling) return;
    
    state.lastCompileTime = now;
    
    if (options.clear !== false) {
      console.clear();
    }
    printWatchHeader(filePath, resolvedOutput, options);
    await compileFile(filePath, resolvedOutput, state, options);
  });
  
  // Also watch the directory for file recreation
  const dirWatcher = watch(dirname(filePath), { persistent: true }, async (eventType, filename) => {
    if (filename !== basename(filePath)) return;
    if (eventType !== 'change' && eventType !== 'rename') return;
    
    const now = Date.now();
    if (now - state.lastCompileTime < config.watchDebounceMs) return;
    if (state.isCompiling) return;
    if (!existsSync(filePath)) return;
    
    state.lastCompileTime = now;
    
    if (options.clear !== false) {
      console.clear();
    }
    printWatchHeader(filePath, resolvedOutput, options);
    await compileFile(filePath, resolvedOutput, state, options);
  });
  
  // Handle exit
  process.on('SIGINT', () => {
    watcher.close();
    dirWatcher.close();
    console.log();
    printWatchSummary(state.stats);
    console.log();
    process.exit(0);
  });
  
  // Keep process running
  await new Promise(() => {});
}

/**
 * Print watch mode header
 */
function printWatchHeader(inputPath: string, outputPath: string, options: WatchOptions): void {
  const theme = getCurrentTheme();
  
  console.log();
  console.log('  ' + chalk.hex(theme.primary)('● watch'));
  console.log();
  console.log('  ' + chalk.hex(theme.dim)('in  ') + chalk.white(getRelativePath(inputPath)));
  console.log('  ' + chalk.hex(theme.dim)('out ') + chalk.white(getRelativePath(outputPath)));
  
  // Show active options
  const activeOpts: string[] = [];
  if (options.diff) activeOpts.push('diff');
  if (options.metrics) activeOpts.push('metrics');
  if (options.notify) activeOpts.push('notify');
  if (options.exec) activeOpts.push('exec');
  
  if (activeOpts.length > 0) {
    console.log('  ' + chalk.hex(theme.dim)('opt ') + chalk.hex(theme.accent)(activeOpts.join(', ')));
  }
  
  console.log();
  console.log('  ' + chalk.hex(theme.dim)('─'.repeat(50)));
  console.log();
}

/**
 * Compile file and show results
 */
async function compileFile(
  filePath: string,
  outputPath: string,
  state: WatchState,
  options: WatchOptions
): Promise<void> {
  const theme = getCurrentTheme();
  const config = loadConfig();
  
  state.isCompiling = true;
  const startTime = performance.now();
  
  const spinner = config.showSpinners ? createSpinner('Compiling...') : null;
  spinner?.start();
  
  try {
    const readResult = readFile(filePath);
    if (!readResult.success) {
      spinner?.fail(chalk.hex(theme.error)('Read failed'));
      console.log('  ' + chalk.hex(theme.dim)(readResult.error));
      state.stats.errors++;
      state.stats.lastStatus = 'error';
      state.isCompiling = false;
      console.log();
      printWatchStatusBar(state.stats);
      return;
    }
    
    const result = compileDslToCsv(readResult.content!);
    const endTime = performance.now();
    const compileTimeMs = endTime - startTime;
    
    if (result.success) {
      const writeResult = writeFile(outputPath, result.csv!);
      
      if (!writeResult.success) {
        spinner?.fail(chalk.hex(theme.error)('Write failed'));
        console.log('  ' + chalk.hex(theme.dim)(writeResult.error));
        state.stats.errors++;
        state.stats.lastStatus = 'error';
        state.isCompiling = false;
        console.log();
        printWatchStatusBar(state.stats);
        return;
      }
      
      state.stats.compiles++;
      state.stats.lastStatus = 'ok';
      
      // Calculate diff if enabled
      let diffResult: DiffResult | null = null;
      if (options.diff && state.previousCsv) {
        diffResult = diffCsv(state.previousCsv, result.csv!);
      }
      
      // Calculate metrics if enabled
      let metricsResult: { metrics: CompileMetrics; delta: MetricsDelta } | null = null;
      if (options.metrics) {
        const metrics = extractMetrics(result, compileTimeMs);
        const delta = calculateMetricsDelta(state.previousMetrics, metrics);
        metricsResult = { metrics, delta };
      }
      
      // Show success with summary
      const summaryParts: string[] = ['Done'];
      if (diffResult) {
        summaryParts.push(formatDiffSummary(diffResult));
      }
      spinner?.succeed(chalk.hex(theme.success)(summaryParts.join(' ')));
      
      // Show compilation stats
      printCompilationStats({
        output: getRelativePath(outputPath),
        cycles: result.maxCycles,
        grid: result.suggestedGridSize,
        memoryRegions: result.memoryRegions?.length || 0,
        time: compileTimeMs,
      });
      
      // Show diff if enabled and there are changes
      if (options.diff && diffResult && diffResult.hasChanges) {
        console.log();
        console.log('  ' + chalk.hex(theme.accent)('─── diff ───'));
        console.log();
        console.log(formatDiff(diffResult, 1));
      }
      
      // Show metrics if enabled
      if (options.metrics && metricsResult) {
        console.log();
        console.log('  ' + chalk.hex(theme.accent)('─── metrics ───'));
        console.log();
        console.log(formatMetrics(metricsResult.metrics, metricsResult.delta));
      }
      
      // Update previous state for next comparison
      state.previousCsv = result.csv!;
      if (metricsResult) {
        state.previousMetrics = metricsResult.metrics;
      }
      
      // Send notification if enabled
      if (options.notify) {
        sendNotification('OpenEdge', `✓ Compiled ${basename(filePath)}`);
      }
      
      // Execute command if specified
      if (options.exec) {
        await executeCommand(options.exec, filePath, outputPath);
      }
      
    } else {
      spinner?.fail(chalk.hex(theme.error)('Failed'));
      state.stats.errors++;
      state.stats.compiles++;
      state.stats.lastStatus = 'error';
      
      if (result.line && readResult.content) {
        printCodeFrame(
          readResult.content,
          result.line,
          1,
          result.error || 'Unknown error',
          getRelativePath(filePath)
        );
      } else {
        console.log();
        console.log('  ' + chalk.hex(theme.error)('error: ') + chalk.white(result.error));
      }
      
      // Send error notification if enabled
      if (options.notify) {
        sendNotification('OpenEdge', `✗ Error in ${basename(filePath)}`);
      }
    }
  } catch (err: any) {
    spinner?.fail(chalk.hex(theme.error)('Error'));
    console.log('  ' + chalk.hex(theme.dim)(err.message));
    state.stats.errors++;
    state.stats.lastStatus = 'error';
  }
  
  state.isCompiling = false;
  console.log();
  printWatchStatusBar(state.stats);
}

/**
 * Send desktop notification (cross-platform)
 */
function sendNotification(title: string, message: string): void {
  const platform = process.platform;
  
  try {
    if (platform === 'darwin') {
      // macOS
      exec(`osascript -e 'display notification "${message}" with title "${title}"'`);
    } else if (platform === 'linux') {
      // Linux (requires notify-send)
      exec(`notify-send "${title}" "${message}"`);
    } else if (platform === 'win32') {
      // Windows (requires PowerShell)
      exec(`powershell -Command "New-BurntToastNotification -Text '${title}', '${message}'"`);
    }
  } catch {
    // Silently fail if notifications aren't available
  }
}

/**
 * Execute a command after successful compile
 */
async function executeCommand(
  command: string, 
  inputPath: string, 
  outputPath: string
): Promise<void> {
  const theme = getCurrentTheme();
  
  // Replace placeholders in command
  const expandedCommand = command
    .replace(/\$INPUT/g, inputPath)
    .replace(/\$OUTPUT/g, outputPath)
    .replace(/\$FILE/g, inputPath);
  
  console.log();
  console.log('  ' + chalk.hex(theme.dim)('exec: ') + chalk.white(expandedCommand));
  
  return new Promise((resolve) => {
    exec(expandedCommand, (error, stdout, stderr) => {
      if (error) {
        console.log('  ' + chalk.hex(theme.error)('✗ ') + chalk.dim(error.message));
      } else {
        if (stdout.trim()) {
          console.log('  ' + chalk.dim(stdout.trim()));
        }
        if (stderr.trim()) {
          console.log('  ' + chalk.yellow(stderr.trim()));
        }
      }
      resolve();
    });
  });
}
