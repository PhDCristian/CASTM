/**
 * Premium Interactive Mode
 * Clean, minimal design inspired by Claude Code and OpenCode
 */

import { select, input } from '@inquirer/prompts';
import { existsSync, readdirSync, statSync } from 'fs';
import { join, dirname, basename, resolve } from 'path';
import { compileDslToCsv } from '../../compiler.js';
import { readFile, writeFile, getOutputPath, getRelativePath } from '../utils/files.js';
import {
  printWelcome,
  printSuccess,
  printError,
  printInfo,
  printHeader,
  printKeyValue,
  printCompilationStats,
  printCodeFrame,
  printFileBadge,
  printDivider,
  printThemePreview,
  printRecentFiles,
  printResult,
  printHint,
  createSpinner,
  clearScreen,
  chalk,
  symbols,
} from '../ui/premium.js';
import {
  loadConfig,
  saveConfig,
  getRecentFiles,
  addRecentFile,
  clearRecentFiles,
  getLastDirectory,
  setLastDirectory,
  getCurrentTheme,
  setTheme,
  getThemeNames,
  BUILTIN_THEMES,
} from '../config/store.js';
import { startWatchMode } from './watch.js';

// Store state
let selectedFile: string | null = null;

/**
 * Custom theme for inquirer - minimal style
 */
function getInquirerTheme() {
  const theme = getCurrentTheme();
  return {
    prefix: chalk.hex(theme.primary)('›'),
    spinner: {
      interval: 80,
      frames: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'].map(f => chalk.hex(theme.primary)(f)),
    },
    style: {
      answer: (text: string) => chalk.hex(theme.primary)(text),
      message: (text: string) => chalk.white(text),
      error: (text: string) => chalk.hex(theme.error)(text),
      help: (text: string) => chalk.hex(theme.dim)(text),
      highlight: (text: string) => chalk.hex(theme.primary)(text),
      key: (text: string) => chalk.hex(theme.primary).bold(text),
    },
  };
}

/**
 * Show recent files menu - clean list
 */
async function showRecentFiles(): Promise<string | null> {
  const theme = getCurrentTheme();
  const recentFiles = getRecentFiles();
  
  if (recentFiles.length === 0) {
    printInfo('No recent files');
    await new Promise(r => setTimeout(r, 1500));
    return null;
  }
  
  clearScreen();
  printHeader('Recent');
  console.log();
  
  const choices = [
    ...recentFiles.map((f, i) => ({
      name: chalk.hex(theme.dim)(`${i + 1}`) + '  ' + 
            chalk.white(basename(f.path)) + 
            chalk.hex(theme.dim)(` · ${dirname(f.path)}`),
      value: f.path,
    })),
    { name: chalk.hex(theme.dim)('─'.repeat(40)), value: '__SEP__', disabled: true } as any,
    { name: chalk.hex(theme.error)('Clear history'), value: '__CLEAR__' },
    { name: chalk.hex(theme.dim)('Back'), value: '__BACK__' },
  ];
  
  const selection = await select({
    message: 'Select file',
    choices,
    pageSize: 12,
    theme: getInquirerTheme(),
  });
  
  if (selection === '__BACK__' || selection === '__SEP__') {
    return null;
  }
  
  if (selection === '__CLEAR__') {
    clearRecentFiles();
    printResult(true, 'History cleared');
    await new Promise(r => setTimeout(r, 1000));
    return null;
  }
  
  return selection;
}

/**
 * Theme selection menu - minimal preview
 */
async function showThemeMenu(): Promise<void> {
  const config = loadConfig();
  const theme = getCurrentTheme();
  
  clearScreen();
  printHeader('Theme');
  console.log();
  console.log('  ' + chalk.hex(theme.dim)('current: ') + chalk.white(BUILTIN_THEMES[config.theme]?.name || config.theme));
  console.log();
  
  const themeNames = getThemeNames();
  const choices = [
    ...themeNames.map(name => {
      const t = BUILTIN_THEMES[name];
      const isCurrent = name === config.theme;
      const swatches = chalk.hex(t.primary)('●') + 
                       chalk.hex(t.secondary)('●') + 
                       chalk.hex(t.accent)('●');
      return {
        name: (isCurrent ? chalk.hex(theme.success)('● ') : '  ') + 
              chalk.white(t.name.padEnd(12)) + ' ' + swatches,
        value: name,
      };
    }),
    { name: chalk.hex(theme.dim)('─'.repeat(40)), value: '__SEP__', disabled: true } as any,
    { name: chalk.hex(theme.dim)('Back'), value: '__BACK__' },
  ];
  
  const selection = await select({
    message: 'Select theme',
    choices,
    pageSize: 12,
    theme: getInquirerTheme(),
  });
  
  if (selection === '__BACK__' || selection === '__SEP__') {
    return;
  }
  
  setTheme(selection);
  printResult(true, `Theme: ${BUILTIN_THEMES[selection].name}`);
  await new Promise(r => setTimeout(r, 800));
}

/**
 * Settings menu - minimal list
 */
async function showSettingsMenu(): Promise<void> {
  while (true) {
    const config = loadConfig();
    const theme = getCurrentTheme();
    
    clearScreen();
    printHeader('Settings');
    console.log();
    
    const choices = [
      { 
        name: chalk.white('Theme') + chalk.hex(theme.dim)(' · ') + chalk.hex(theme.primary)(BUILTIN_THEMES[config.theme]?.name),
        value: 'theme',
      },
      {
        name: chalk.white('Recent files limit') + chalk.hex(theme.dim)(' · ') + chalk.hex(theme.primary)(config.recentFilesLimit),
        value: 'recentLimit',
      },
      {
        name: chalk.white('Spinners') + chalk.hex(theme.dim)(' · ') + (config.showSpinners ? chalk.hex(theme.success)('on') : chalk.hex(theme.dim)('off')),
        value: 'spinners',
      },
      {
        name: chalk.white('Clear on action') + chalk.hex(theme.dim)(' · ') + (config.clearScreenOnAction ? chalk.hex(theme.success)('on') : chalk.hex(theme.dim)('off')),
        value: 'clearScreen',
      },
      { name: chalk.hex(theme.dim)('─'.repeat(40)), value: '__SEP__', disabled: true } as any,
      { name: chalk.hex(theme.dim)('Back'), value: '__BACK__' },
    ];
    
    const selection = await select({
      message: 'Configure',
      choices,
      theme: getInquirerTheme(),
    });
    
    if (selection === '__BACK__') {
      return;
    }
    
    switch (selection) {
      case 'theme':
        await showThemeMenu();
        break;
        
      case 'recentLimit':
        const limitStr = await input({
          message: 'Limit (1-50):',
          default: String(config.recentFilesLimit),
          theme: getInquirerTheme(),
        });
        const limit = parseInt(limitStr, 10);
        if (limit >= 1 && limit <= 50) {
          config.recentFilesLimit = limit;
          saveConfig(config);
          printResult(true, `Limit: ${limit}`);
        }
        break;
        
      case 'spinners':
        config.showSpinners = !config.showSpinners;
        saveConfig(config);
        break;
        
      case 'clearScreen':
        config.clearScreenOnAction = !config.clearScreenOnAction;
        saveConfig(config);
        break;
    }
  }
}

/**
 * Browse for a DSL file - clean file tree
 */
async function browseForFile(): Promise<string | null> {
  let currentDir = getLastDirectory();
  const theme = getCurrentTheme();
  
  while (true) {
    clearScreen();
    printHeader('Browse');
    console.log('  ' + chalk.hex(theme.dim)(currentDir));
    console.log();
    
    let entries: string[];
    try {
      entries = readdirSync(currentDir);
    } catch {
      entries = [];
    }
    
    const dirs = entries.filter(e => {
      try {
        return statSync(join(currentDir, e)).isDirectory() && !e.startsWith('.');
      } catch {
        return false;
      }
    }).sort();
    
    const dslFiles = entries.filter(e => e.endsWith('.dsl')).sort();
    
    const choices: { name: string; value: string }[] = [];
    
    // Parent directory
    if (currentDir !== '/') {
      choices.push({ 
        name: chalk.hex(theme.dim)('..'), 
        value: '__PARENT__' 
      });
    }
    
    // Directories
    dirs.forEach(d => {
      choices.push({ 
        name: chalk.hex(theme.accent)(symbols.folder) + ' ' + chalk.hex(theme.accent)(d), 
        value: `__DIR__:${d}` 
      });
    });
    
    // DSL files
    dslFiles.forEach(f => {
      choices.push({ 
        name: chalk.hex(theme.dim)(symbols.file) + ' ' + chalk.white(f), 
        value: join(currentDir, f),
      });
    });
    
    // Options
    choices.push({ name: chalk.hex(theme.dim)('─'.repeat(40)), value: '__SEP__', disabled: true } as any);
    choices.push({ name: chalk.white('Enter path'), value: '__MANUAL__' });
    choices.push({ name: chalk.hex(theme.dim)('Cancel'), value: '__CANCEL__' });
    
    const selection = await select({
      message: 'Select',
      choices,
      pageSize: 15,
      theme: getInquirerTheme(),
    });
    
    if (selection === '__CANCEL__') {
      return null;
    }
    
    if (selection === '__PARENT__') {
      currentDir = dirname(currentDir);
      continue;
    }
    
    if (selection === '__MANUAL__') {
      const manualPath = await input({
        message: 'Path:',
        default: join(currentDir, 'kernel.dsl'),
        theme: getInquirerTheme(),
      });
      if (existsSync(manualPath)) {
        setLastDirectory(dirname(resolve(manualPath)));
        return resolve(manualPath);
      } else {
        printError('Not found', manualPath);
        await new Promise(r => setTimeout(r, 1500));
        continue;
      }
    }
    
    if (selection.startsWith('__DIR__:')) {
      currentDir = join(currentDir, selection.replace('__DIR__:', ''));
      continue;
    }
    
    // It's a file
    setLastDirectory(dirname(selection));
    addRecentFile(selection);
    return selection;
  }
}

/**
 * Compile action - minimal output
 */
async function doCompile(filePath: string): Promise<void> {
  const theme = getCurrentTheme();
  const config = loadConfig();
  
  if (config.clearScreenOnAction) {
    clearScreen();
  }
  
  printHeader('Compile');
  console.log('  ' + chalk.hex(theme.dim)('source ') + chalk.white(getRelativePath(filePath)));
  console.log();
  
  const spinner = config.showSpinners ? createSpinner('Reading...') : null;
  spinner?.start();
  
  const startTime = performance.now();
  
  if (config.showSpinners) await new Promise(r => setTimeout(r, 200));
  
  const readResult = readFile(filePath);
  if (!readResult.success) {
    spinner?.fail(chalk.hex(theme.error)('Read failed'));
    printError('Error', readResult.error);
    return;
  }
  
  if (spinner) spinner.text = 'Compiling...';
  if (config.showSpinners) await new Promise(r => setTimeout(r, 150));
  
  const result = compileDslToCsv(readResult.content!);
  
  if (result.success) {
    spinner?.stop();
    console.log();
    
    const defaultOutput = getOutputPath(filePath);
    const outputPath = await input({
      message: 'Output',
      default: defaultOutput,
      theme: getInquirerTheme(),
    });
    
    const writeSpinner = config.showSpinners ? createSpinner('Writing...') : null;
    writeSpinner?.start();
    
    if (config.showSpinners) await new Promise(r => setTimeout(r, 150));
    
    const writeResult = writeFile(outputPath, result.csv!);
    if (!writeResult.success) {
      writeSpinner?.fail(chalk.hex(theme.error)('Write failed'));
      printError('Error', writeResult.error);
      return;
    }
    
    const endTime = performance.now();
    writeSpinner?.succeed(chalk.hex(theme.success)('Done'));
    
    addRecentFile(filePath);
    
    printCompilationStats({
      output: getRelativePath(outputPath),
      cycles: result.maxCycles,
      grid: result.suggestedGridSize,
      memoryRegions: result.memoryRegions?.length || 0,
      assertions: result.assertions?.length || 0,
      time: endTime - startTime,
    });
  } else {
    spinner?.fail(chalk.hex(theme.error)('Failed'));
    
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
}

/**
 * Check action - minimal output
 */
async function doCheck(filePath: string): Promise<void> {
  const theme = getCurrentTheme();
  const config = loadConfig();
  
  if (config.clearScreenOnAction) {
    clearScreen();
  }
  
  printHeader('Validate');
  console.log('  ' + chalk.hex(theme.dim)('source ') + chalk.white(getRelativePath(filePath)));
  console.log();
  
  const spinner = config.showSpinners ? createSpinner('Checking...') : null;
  spinner?.start();
  
  if (config.showSpinners) await new Promise(r => setTimeout(r, 300));
  
  const readResult = readFile(filePath);
  if (!readResult.success) {
    spinner?.fail(chalk.hex(theme.error)('Read failed'));
    printError('Error', readResult.error);
    return;
  }
  
  const result = compileDslToCsv(readResult.content!);
  
  if (result.success) {
    spinner?.succeed(chalk.hex(theme.success)('Valid'));
    addRecentFile(filePath);
    console.log();
    printKeyValue('cycles', result.maxCycles || 0);
    printKeyValue('memory', `${result.memoryRegions?.length || 0} regions`);
    if (result.assertions && result.assertions.length > 0) {
      printKeyValue('assertions', result.assertions.length);
    }
  } else {
    spinner?.fail(chalk.hex(theme.error)('Invalid'));
    
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
}

/**
 * Info action - clean layout
 */
async function doInfo(filePath: string): Promise<void> {
  const theme = getCurrentTheme();
  const config = loadConfig();
  
  if (config.clearScreenOnAction) {
    clearScreen();
  }
  
  printHeader('Info');
  console.log('  ' + chalk.hex(theme.dim)('source ') + chalk.white(getRelativePath(filePath)));
  console.log();
  
  const spinner = config.showSpinners ? createSpinner('Analyzing...') : null;
  spinner?.start();
  
  if (config.showSpinners) await new Promise(r => setTimeout(r, 300));
  
  const readResult = readFile(filePath);
  if (!readResult.success) {
    spinner?.fail(chalk.hex(theme.error)('Read failed'));
    printError('Error', readResult.error);
    return;
  }
  
  const result = compileDslToCsv(readResult.content!);
  
  spinner?.stop();
  console.log();
  
  if (result.success) {
    console.log('  ' + chalk.hex(theme.success)('● valid'));
    console.log();
    
    addRecentFile(filePath);
    
    if (result.maxCycles !== undefined) {
      printKeyValue('cycles', result.maxCycles);
    }
    
    if (result.suggestedGridSize) {
      printKeyValue('grid', `${result.suggestedGridSize.width}×${result.suggestedGridSize.height}`);
    }
    
    if (result.memoryRegions && result.memoryRegions.length > 0) {
      console.log();
      console.log('  ' + chalk.white('Memory'));
      result.memoryRegions.forEach(region => {
        const name = region.name || chalk.hex(theme.dim)('anon');
        const addr = chalk.hex(theme.primary)(`0x${region.start.toString(16).toUpperCase()}`);
        console.log(`    ${chalk.hex(theme.dim)(symbols.dot)} ${name} ${chalk.hex(theme.dim)('at')} ${addr} ${chalk.hex(theme.dim)(`(${region.values.length})`)}`);
      });
    }
    
    if (result.assertions && result.assertions.length > 0) {
      console.log();
      printKeyValue('assertions', result.assertions.length);
    }
  } else {
    console.log('  ' + chalk.hex(theme.error)('● invalid'));
    console.log();
    printKeyValue('error', result.error || 'Unknown');
    if (result.line) {
      printKeyValue('line', result.line);
    }
  }
}

/**
 * Watch mode action
 */
async function doWatch(filePath: string): Promise<void> {
  const theme = getCurrentTheme();
  
  console.log();
  const outputPath = await input({
    message: 'Output',
    default: getOutputPath(filePath),
    theme: getInquirerTheme(),
  });
  
  console.log();
  printInfo('Starting watch mode...');
  printHint('Press Ctrl+C to stop');
  
  await new Promise(r => setTimeout(r, 500));
  
  await startWatchMode(filePath, outputPath);
}

/**
 * Wait for keypress - minimal prompt
 */
async function waitForKey(): Promise<void> {
  const theme = getCurrentTheme();
  console.log();
  printHint('Press Enter to continue');
  await input({ message: '', theme: { ...getInquirerTheme(), prefix: '' } });
}

/**
 * Main interactive loop - clean menu
 */
export async function runInteractiveMode(): Promise<void> {
  printWelcome();
  
  while (true) {
    const theme = getCurrentTheme();
    const recentFiles = getRecentFiles();
    
    // Build menu
    const choices: { name: string; value: string }[] = [];
    
    if (selectedFile) {
      // Show current file
      console.log();
      console.log('  ' + chalk.hex(theme.dim)('file ') + chalk.hex(theme.primary)(basename(selectedFile)));
      console.log('  ' + chalk.hex(theme.dim)(dirname(selectedFile)));
      console.log();
      
      choices.push(
        { name: chalk.white('Compile') + chalk.hex(theme.dim)(' → CSV'), value: 'compile' },
        { name: chalk.white('Validate') + chalk.hex(theme.dim)(' syntax'), value: 'check' },
        { name: chalk.white('Info') + chalk.hex(theme.dim)(' details'), value: 'info' },
        { name: chalk.white('Watch') + chalk.hex(theme.dim)(' auto-rebuild'), value: 'watch' },
        { name: chalk.hex(theme.dim)('─'.repeat(40)), value: '__SEP1__', disabled: true } as any,
        { name: chalk.white('Change file'), value: 'browse' },
      );
    } else {
      choices.push(
        { name: chalk.white('Open file'), value: 'browse' },
      );
    }
    
    // Recent files
    if (!selectedFile && recentFiles.length > 0) {
      choices.push({
        name: chalk.white('Recent') + chalk.hex(theme.dim)(` (${recentFiles.length})`),
        value: 'recent',
      });
    }
    
    choices.push({ name: chalk.hex(theme.dim)('─'.repeat(40)), value: '__SEP2__', disabled: true } as any);
    choices.push({ name: chalk.white('Settings'), value: 'settings' });
    choices.push({ name: chalk.hex(theme.dim)('Exit'), value: 'exit' });
    
    const action = await select({
      message: selectedFile ? 'Action' : 'Start',
      choices,
      theme: getInquirerTheme(),
    });
    
    switch (action) {
      case 'browse':
        selectedFile = await browseForFile();
        clearScreen();
        printWelcome();
        break;
        
      case 'recent':
        const recentFile = await showRecentFiles();
        if (recentFile) {
          selectedFile = recentFile;
          addRecentFile(recentFile);
        }
        clearScreen();
        printWelcome();
        break;
        
      case 'compile':
        if (selectedFile) {
          await doCompile(selectedFile);
          await waitForKey();
          clearScreen();
          printWelcome();
        }
        break;
        
      case 'check':
        if (selectedFile) {
          await doCheck(selectedFile);
          await waitForKey();
          clearScreen();
          printWelcome();
        }
        break;
        
      case 'info':
        if (selectedFile) {
          await doInfo(selectedFile);
          await waitForKey();
          clearScreen();
          printWelcome();
        }
        break;
        
      case 'watch':
        if (selectedFile) {
          await doWatch(selectedFile);
        }
        break;
        
      case 'settings':
        await showSettingsMenu();
        clearScreen();
        printWelcome();
        break;
        
      case 'exit':
        console.log();
        console.log('  ' + chalk.hex(theme.dim)('Goodbye'));
        console.log();
        process.exit(0);
    }
  }
}
