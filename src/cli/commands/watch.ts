/**
 * Watch mode - auto-recompilation on file changes
 */

import { watch, existsSync } from 'fs';
import { basename, dirname } from 'path';
import { compileDslToCsv } from '../../compiler.js';
import { readFile, writeFile, getOutputPath, getRelativePath } from '../utils/files.js';
import {
  printHeader,
  printSuccess,
  printError,
  printInfo,
  printCompilationStats,
  printCodeFrame,
  createSpinner,
  chalk,
  symbols,
} from '../ui/premium.js';
import { loadConfig } from '../config/store.js';

interface WatchState {
  isCompiling: boolean;
  lastCompileTime: number;
  compileCount: number;
  errorCount: number;
}

/**
 * Start watching a file for changes
 */
export async function startWatchMode(
  filePath: string,
  outputPath?: string
): Promise<void> {
  const config = loadConfig();
  const resolvedOutput = outputPath || getOutputPath(filePath);
  
  const state: WatchState = {
    isCompiling: false,
    lastCompileTime: 0,
    compileCount: 0,
    errorCount: 0,
  };
  
  // Initial compile
  console.clear();
  printWatchHeader(filePath, resolvedOutput);
  await compileFile(filePath, resolvedOutput, state);
  
  // Watch for changes
  const watcher = watch(filePath, { persistent: true }, async (eventType) => {
    if (eventType !== 'change') return;
    
    // Debounce
    const now = Date.now();
    if (now - state.lastCompileTime < config.watchDebounceMs) return;
    if (state.isCompiling) return;
    
    state.lastCompileTime = now;
    
    console.clear();
    printWatchHeader(filePath, resolvedOutput);
    await compileFile(filePath, resolvedOutput, state);
  });
  
  // Also watch the directory for file recreation
  const dirWatcher = watch(dirname(filePath), { persistent: true }, async (eventType, filename) => {
    if (filename !== basename(filePath)) return;
    if (eventType !== 'change' && eventType !== 'rename') return;
    
    // Debounce
    const now = Date.now();
    if (now - state.lastCompileTime < config.watchDebounceMs) return;
    if (state.isCompiling) return;
    
    // Check if file exists (might have been deleted)
    if (!existsSync(filePath)) return;
    
    state.lastCompileTime = now;
    
    console.clear();
    printWatchHeader(filePath, resolvedOutput);
    await compileFile(filePath, resolvedOutput, state);
  });
  
  // Handle exit
  process.on('SIGINT', () => {
    watcher.close();
    dirWatcher.close();
    console.log();
    console.log();
    printInfo('Watch mode stopped');
    printWatchStats(state);
    console.log();
    process.exit(0);
  });
  
  // Keep alive
  printWatchInstructions();
  
  // Keep process running
  await new Promise(() => {});
}

/**
 * Print watch mode header
 */
function printWatchHeader(inputPath: string, outputPath: string): void {
  console.log();
  console.log('  ' + chalk.bgCyan.black(' WATCH MODE '));
  console.log();
  console.log('  ' + chalk.dim('Input:  ') + chalk.cyan(getRelativePath(inputPath)));
  console.log('  ' + chalk.dim('Output: ') + chalk.cyan(getRelativePath(outputPath)));
  console.log();
  console.log('  ' + chalk.dim('─'.repeat(50)));
  console.log();
}

/**
 * Print watch instructions
 */
function printWatchInstructions(): void {
  console.log();
  console.log('  ' + chalk.dim('─'.repeat(50)));
  console.log();
  console.log('  ' + chalk.dim('Watching for changes...'));
  console.log('  ' + chalk.dim('Press ') + chalk.cyan('Ctrl+C') + chalk.dim(' to stop'));
  console.log();
}

/**
 * Print watch stats on exit
 */
function printWatchStats(state: WatchState): void {
  console.log();
  console.log('  ' + chalk.bold('Session Stats'));
  console.log('  ' + chalk.dim('─'.repeat(20)));
  console.log('  ' + chalk.dim('Compilations: ') + chalk.white(state.compileCount));
  console.log('  ' + chalk.dim('Errors:       ') + (state.errorCount > 0 ? chalk.red(state.errorCount) : chalk.green('0')));
}

/**
 * Compile file and show results
 */
async function compileFile(
  filePath: string,
  outputPath: string,
  state: WatchState
): Promise<void> {
  state.isCompiling = true;
  const startTime = performance.now();
  
  const spinner = createSpinner('Compiling...');
  spinner.start();
  
  try {
    const readResult = readFile(filePath);
    if (!readResult.success) {
      spinner.fail(chalk.red('Failed to read file'));
      printError('Read Error', readResult.error);
      state.errorCount++;
      state.isCompiling = false;
      printWatchInstructions();
      return;
    }
    
    const result = compileDslToCsv(readResult.content!);
    
    if (result.success) {
      const writeResult = writeFile(outputPath, result.csv!);
      
      if (!writeResult.success) {
        spinner.fail(chalk.red('Failed to write output'));
        printError('Write Error', writeResult.error);
        state.errorCount++;
        state.isCompiling = false;
        printWatchInstructions();
        return;
      }
      
      const endTime = performance.now();
      state.compileCount++;
      
      spinner.succeed(chalk.green('Compiled successfully'));
      
      printCompilationStats({
        output: getRelativePath(outputPath),
        cycles: result.maxCycles,
        grid: result.suggestedGridSize,
        memoryRegions: result.memoryRegions?.length || 0,
        time: endTime - startTime,
      });
      
    } else {
      spinner.fail(chalk.red('Compilation failed'));
      state.errorCount++;
      state.compileCount++;
      
      if (result.line && readResult.content) {
        printCodeFrame(
          readResult.content,
          result.line,
          1,
          result.error || 'Unknown error',
          getRelativePath(filePath)
        );
      } else {
        printError('Error', result.error || 'Unknown error');
      }
    }
  } catch (err: any) {
    spinner.fail(chalk.red('Unexpected error'));
    printError('Error', err.message);
    state.errorCount++;
  }
  
  state.isCompiling = false;
  printWatchInstructions();
}
