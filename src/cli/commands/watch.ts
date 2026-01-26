/**
 * Watch mode - auto-recompilation on file changes
 * Clean, minimal design
 */

import { watch, existsSync } from 'fs';
import { basename, dirname } from 'path';
import { compileDslToCsv } from '../../compiler.js';
import { readFile, writeFile, getOutputPath, getRelativePath } from '../utils/files.js';
import {
  printHeader,
  printResult,
  printCompilationStats,
  printCodeFrame,
  printHint,
  printDivider,
  createSpinner,
  chalk,
  symbols,
} from '../ui/premium.js';
import { loadConfig, getCurrentTheme } from '../config/store.js';

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
    
    const now = Date.now();
    if (now - state.lastCompileTime < config.watchDebounceMs) return;
    if (state.isCompiling) return;
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
    printWatchStats(state);
    console.log();
    process.exit(0);
  });
  
  printWatchInstructions();
  
  // Keep process running
  await new Promise(() => {});
}

/**
 * Print watch mode header - minimal
 */
function printWatchHeader(inputPath: string, outputPath: string): void {
  const theme = getCurrentTheme();
  
  console.log();
  console.log('  ' + chalk.hex(theme.primary)('● watch'));
  console.log();
  console.log('  ' + chalk.hex(theme.dim)('in  ') + chalk.white(getRelativePath(inputPath)));
  console.log('  ' + chalk.hex(theme.dim)('out ') + chalk.white(getRelativePath(outputPath)));
  console.log();
  console.log('  ' + chalk.hex(theme.dim)('─'.repeat(40)));
  console.log();
}

/**
 * Print watch instructions - subtle
 */
function printWatchInstructions(): void {
  const theme = getCurrentTheme();
  console.log();
  console.log('  ' + chalk.hex(theme.dim)('─'.repeat(40)));
  console.log();
  printHint('Watching for changes... Ctrl+C to stop');
  console.log();
}

/**
 * Print watch stats on exit
 */
function printWatchStats(state: WatchState): void {
  const theme = getCurrentTheme();
  
  console.log('  ' + chalk.white('Session'));
  console.log('  ' + chalk.hex(theme.dim)('─'.repeat(20)));
  console.log('  ' + chalk.hex(theme.dim)('compiles ') + chalk.white(state.compileCount));
  console.log('  ' + chalk.hex(theme.dim)('errors   ') + 
    (state.errorCount > 0 ? chalk.hex(theme.error)(state.errorCount) : chalk.hex(theme.success)('0')));
}

/**
 * Compile file and show results - minimal output
 */
async function compileFile(
  filePath: string,
  outputPath: string,
  state: WatchState
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
      state.errorCount++;
      state.isCompiling = false;
      printWatchInstructions();
      return;
    }
    
    const result = compileDslToCsv(readResult.content!);
    
    if (result.success) {
      const writeResult = writeFile(outputPath, result.csv!);
      
      if (!writeResult.success) {
        spinner?.fail(chalk.hex(theme.error)('Write failed'));
        console.log('  ' + chalk.hex(theme.dim)(writeResult.error));
        state.errorCount++;
        state.isCompiling = false;
        printWatchInstructions();
        return;
      }
      
      const endTime = performance.now();
      state.compileCount++;
      
      spinner?.succeed(chalk.hex(theme.success)('Done'));
      
      printCompilationStats({
        output: getRelativePath(outputPath),
        cycles: result.maxCycles,
        grid: result.suggestedGridSize,
        memoryRegions: result.memoryRegions?.length || 0,
        time: endTime - startTime,
      });
      
    } else {
      spinner?.fail(chalk.hex(theme.error)('Failed'));
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
        console.log();
        console.log('  ' + chalk.hex(theme.error)('error: ') + chalk.white(result.error));
      }
    }
  } catch (err: any) {
    spinner?.fail(chalk.hex(theme.error)('Error'));
    console.log('  ' + chalk.hex(theme.dim)(err.message));
    state.errorCount++;
  }
  
  state.isCompiling = false;
  printWatchInstructions();
}
