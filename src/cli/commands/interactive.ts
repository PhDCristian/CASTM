/**
 * Premium Interactive Mode
 * With recent files, watch mode, and theme selection
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
 * Custom theme for inquirer based on current theme
 */
function getInquirerTheme() {
  const theme = getCurrentTheme();
  return {
    prefix: chalk.hex(theme.primary)('❯'),
    spinner: {
      interval: 80,
      frames: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'].map(f => chalk.hex(theme.primary)(f)),
    },
    style: {
      answer: (text: string) => chalk.hex(theme.primary)(text),
      message: (text: string) => chalk.bold.white(text),
      error: (text: string) => chalk.hex(theme.error)(text),
      help: (text: string) => chalk.hex(theme.dim)(text),
      highlight: (text: string) => chalk.hex(theme.primary)(text),
      key: (text: string) => chalk.hex(theme.primary).bold(text),
    },
  };
}

/**
 * Show recent files menu
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
  printHeader(`${symbols.clock} Recent Files`);
  console.log();
  
  const choices = [
    ...recentFiles.map((f, i) => ({
      name: chalk.hex(theme.primary)(`${i + 1}.`) + ' ' + chalk.white(basename(f.path)) + 
            chalk.hex(theme.dim)(` (${f.accessCount}×)`),
      value: f.path,
      description: dirname(f.path),
    })),
    { name: chalk.hex(theme.dim)('─'.repeat(30)), value: '__SEP__', disabled: true } as any,
    { name: chalk.hex(theme.error)('🗑  Clear history'), value: '__CLEAR__' },
    { name: chalk.yellow('← Back'), value: '__BACK__' },
  ];
  
  const selection = await select({
    message: 'Select a recent file',
    choices,
    pageSize: 15,
    theme: getInquirerTheme(),
  });
  
  if (selection === '__BACK__' || selection === '__SEP__') {
    return null;
  }
  
  if (selection === '__CLEAR__') {
    clearRecentFiles();
    printSuccess('History cleared');
    await new Promise(r => setTimeout(r, 1000));
    return null;
  }
  
  return selection;
}

/**
 * Theme selection menu
 */
async function showThemeMenu(): Promise<void> {
  const config = loadConfig();
  
  clearScreen();
  printHeader(`${symbols.palette} Theme Selection`);
  console.log();
  console.log('  ' + chalk.dim('Current theme: ') + chalk.white(BUILTIN_THEMES[config.theme]?.name || config.theme));
  console.log();
  
  const themeNames = getThemeNames();
  const choices = [
    ...themeNames.map(name => {
      const theme = BUILTIN_THEMES[name];
      const isCurrent = name === config.theme;
      const preview = chalk.hex(theme.primary)('■') + 
                     chalk.hex(theme.secondary)('■') + 
                     chalk.hex(theme.accent)('■');
      return {
        name: (isCurrent ? chalk.green('● ') : '  ') + 
              chalk.white(theme.name) + ' ' + preview,
        value: name,
      };
    }),
    { name: chalk.hex(getCurrentTheme().dim)('─'.repeat(30)), value: '__SEP__', disabled: true } as any,
    { name: chalk.yellow('← Back'), value: '__BACK__' },
  ];
  
  const selection = await select({
    message: 'Select a theme',
    choices,
    pageSize: 12,
    theme: getInquirerTheme(),
  });
  
  if (selection === '__BACK__' || selection === '__SEP__') {
    return;
  }
  
  setTheme(selection);
  printSuccess(`Theme changed to ${BUILTIN_THEMES[selection].name}`);
  await new Promise(r => setTimeout(r, 1000));
}

/**
 * Settings menu
 */
async function showSettingsMenu(): Promise<void> {
  const theme = getCurrentTheme();
  
  while (true) {
    const config = loadConfig();
    
    clearScreen();
    printHeader(`${symbols.gear} Settings`);
    console.log();
    
    const choices = [
      { 
        name: `${symbols.palette} Theme: ${chalk.hex(theme.primary)(BUILTIN_THEMES[config.theme]?.name || config.theme)}`,
        value: 'theme',
      },
      {
        name: `${symbols.clock} Recent files limit: ${chalk.hex(theme.primary)(config.recentFilesLimit)}`,
        value: 'recentLimit',
      },
      {
        name: `${symbols.sparkle} Show spinners: ${config.showSpinners ? chalk.green('Yes') : chalk.red('No')}`,
        value: 'spinners',
      },
      {
        name: `${symbols.file} Clear screen on action: ${config.clearScreenOnAction ? chalk.green('Yes') : chalk.red('No')}`,
        value: 'clearScreen',
      },
      { name: chalk.hex(theme.dim)('─'.repeat(30)), value: '__SEP__', disabled: true } as any,
      { name: chalk.yellow('← Back to menu'), value: '__BACK__' },
    ];
    
    const selection = await select({
      message: 'Settings',
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
          message: 'Recent files limit (1-50):',
          default: String(config.recentFilesLimit),
          theme: getInquirerTheme(),
        });
        const limit = parseInt(limitStr, 10);
        if (limit >= 1 && limit <= 50) {
          config.recentFilesLimit = limit;
          saveConfig(config);
          printSuccess(`Limit set to ${limit}`);
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
 * Browse for a DSL file with premium UI
 */
async function browseForFile(): Promise<string | null> {
  let currentDir = getLastDirectory();
  const theme = getCurrentTheme();
  
  while (true) {
    clearScreen();
    printHeader(`${symbols.folder} File Browser`);
    console.log('  ' + chalk.hex(theme.dim)('Location: ') + chalk.hex(theme.primary)(currentDir));
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
    
    const choices: { name: string; value: string; description?: string }[] = [];
    
    // Parent directory
    if (currentDir !== '/') {
      choices.push({ 
        name: chalk.hex(theme.dim)('..') + chalk.hex(theme.dim)(' (parent)'), 
        value: '__PARENT__' 
      });
    }
    
    // Directories first
    dirs.forEach(d => {
      choices.push({ 
        name: chalk.blue(`${symbols.folder} `) + chalk.blue(d), 
        value: `__DIR__:${d}` 
      });
    });
    
    // DSL files
    dslFiles.forEach(f => {
      choices.push({ 
        name: chalk.green(`${symbols.file} `) + chalk.white(f), 
        value: join(currentDir, f),
        description: 'DSL source file'
      });
    });
    
    // Options
    choices.push({ name: chalk.hex(theme.dim)('─'.repeat(30)), value: '__SEP__', disabled: true } as any);
    choices.push({ name: chalk.yellow('✏️  Enter path manually'), value: '__MANUAL__' });
    choices.push({ name: chalk.red('← Back to menu'), value: '__CANCEL__' });
    
    const selection = await select({
      message: 'Select a file or directory',
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
        message: 'Enter file path:',
        default: join(currentDir, 'kernel.dsl'),
        theme: getInquirerTheme(),
      });
      if (existsSync(manualPath)) {
        setLastDirectory(dirname(resolve(manualPath)));
        return resolve(manualPath);
      } else {
        printError('File not found', manualPath);
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
 * Compile action with spinner
 */
async function doCompile(filePath: string): Promise<void> {
  const theme = getCurrentTheme();
  const config = loadConfig();
  
  if (config.clearScreenOnAction) {
    clearScreen();
  }
  printHeader('🔨 Compile');
  printFileBadge(getRelativePath(filePath));
  console.log();
  
  const spinner = config.showSpinners ? createSpinner('Reading source file...') : null;
  spinner?.start();
  
  const startTime = performance.now();
  
  if (config.showSpinners) {
    await new Promise(r => setTimeout(r, 300));
  }
  
  const readResult = readFile(filePath);
  if (!readResult.success) {
    spinner?.fail(chalk.hex(theme.error)('Failed to read file'));
    printError('Read Error', readResult.error);
    return;
  }
  
  if (spinner) spinner.text = 'Compiling...';
  if (config.showSpinners) {
    await new Promise(r => setTimeout(r, 200));
  }
  
  const result = compileDslToCsv(readResult.content!);
  
  if (result.success) {
    if (spinner) spinner.text = 'Writing output...';
    
    const defaultOutput = getOutputPath(filePath);
    
    spinner?.stop();
    console.log();
    
    const outputPath = await input({
      message: 'Output file',
      default: defaultOutput,
      theme: getInquirerTheme(),
    });
    
    const writeSpinner = config.showSpinners ? createSpinner('Writing CSV...') : null;
    writeSpinner?.start();
    
    if (config.showSpinners) {
      await new Promise(r => setTimeout(r, 200));
    }
    
    const writeResult = writeFile(outputPath, result.csv!);
    if (!writeResult.success) {
      writeSpinner?.fail(chalk.hex(theme.error)('Failed to write file'));
      printError('Write Error', writeResult.error);
      return;
    }
    
    const endTime = performance.now();
    writeSpinner?.succeed(chalk.hex(theme.success)('Compiled successfully'));
    
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
    spinner?.fail(chalk.hex(theme.error)('Compilation failed'));
    
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
 * Check action with spinner
 */
async function doCheck(filePath: string): Promise<void> {
  const theme = getCurrentTheme();
  const config = loadConfig();
  
  if (config.clearScreenOnAction) {
    clearScreen();
  }
  printHeader('✅ Validate');
  printFileBadge(getRelativePath(filePath));
  console.log();
  
  const spinner = config.showSpinners ? createSpinner('Validating syntax...') : null;
  spinner?.start();
  
  if (config.showSpinners) {
    await new Promise(r => setTimeout(r, 400));
  }
  
  const readResult = readFile(filePath);
  if (!readResult.success) {
    spinner?.fail(chalk.hex(theme.error)('Failed to read file'));
    printError('Read Error', readResult.error);
    return;
  }
  
  const result = compileDslToCsv(readResult.content!);
  
  if (result.success) {
    spinner?.succeed(chalk.hex(theme.success)('No errors found'));
    addRecentFile(filePath);
    console.log();
    printKeyValue('Cycles', result.maxCycles || 0);
    printKeyValue('Memory regions', result.memoryRegions?.length || 0);
    if (result.assertions && result.assertions.length > 0) {
      printKeyValue('Assertions', result.assertions.length);
    }
  } else {
    spinner?.fail(chalk.hex(theme.error)('Validation failed'));
    
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
 * Info action
 */
async function doInfo(filePath: string): Promise<void> {
  const theme = getCurrentTheme();
  const config = loadConfig();
  
  if (config.clearScreenOnAction) {
    clearScreen();
  }
  printHeader('ℹ️  Program Info');
  printFileBadge(getRelativePath(filePath));
  console.log();
  
  const spinner = config.showSpinners ? createSpinner('Analyzing program...') : null;
  spinner?.start();
  
  if (config.showSpinners) {
    await new Promise(r => setTimeout(r, 400));
  }
  
  const readResult = readFile(filePath);
  if (!readResult.success) {
    spinner?.fail(chalk.hex(theme.error)('Failed to read file'));
    printError('Read Error', readResult.error);
    return;
  }
  
  const result = compileDslToCsv(readResult.content!);
  
  spinner?.stop();
  console.log();
  
  if (result.success) {
    console.log('  ' + chalk.bgHex(theme.success).black(' VALID '));
    console.log();
    
    addRecentFile(filePath);
    
    printKeyValue('Status', chalk.hex(theme.success)('Valid'));
    
    if (result.maxCycles !== undefined) {
      printKeyValue('Cycles', result.maxCycles);
    }
    
    if (result.suggestedGridSize) {
      printKeyValue('Grid size', `${result.suggestedGridSize.width}×${result.suggestedGridSize.height}`);
    }
    
    if (result.memoryRegions && result.memoryRegions.length > 0) {
      console.log();
      printHeader('Memory Regions');
      result.memoryRegions.forEach(region => {
        const name = region.name || chalk.hex(theme.dim)('anonymous');
        const addr = chalk.hex(theme.primary)(`0x${region.start.toString(16).toUpperCase()}`);
        console.log(`    ${chalk.hex(theme.dim)('•')} ${name} ${chalk.hex(theme.dim)('at')} ${addr} ${chalk.hex(theme.dim)(`(${region.values.length} values)`)}`);
      });
    }
    
    if (result.assertions && result.assertions.length > 0) {
      console.log();
      printHeader('Assertions');
      printKeyValue('Count', result.assertions.length);
    }
  } else {
    console.log('  ' + chalk.bgHex(theme.error).white(' INVALID '));
    console.log();
    printKeyValue('Status', chalk.hex(theme.error)('Invalid'));
    printKeyValue('Error', result.error || 'Unknown');
    if (result.line) {
      printKeyValue('Line', result.line);
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
    message: 'Output file',
    default: getOutputPath(filePath),
    theme: getInquirerTheme(),
  });
  
  console.log();
  printInfo('Starting watch mode...');
  console.log('  ' + chalk.hex(theme.dim)('Press Ctrl+C to stop'));
  
  await new Promise(r => setTimeout(r, 500));
  
  await startWatchMode(filePath, outputPath);
}

/**
 * Wait for keypress
 */
async function waitForKey(): Promise<void> {
  const theme = getCurrentTheme();
  console.log();
  console.log('  ' + chalk.hex(theme.dim)('Press Enter to continue...'));
  await input({ message: '', theme: { ...getInquirerTheme(), prefix: '' } });
}

/**
 * Main interactive loop with premium UI
 */
export async function runInteractiveMode(): Promise<void> {
  printWelcome();
  
  while (true) {
    const theme = getCurrentTheme();
    const recentFiles = getRecentFiles();
    
    // Build menu
    const choices: { name: string; value: string; description?: string }[] = [];
    
    if (selectedFile) {
      // Show current file
      console.log();
      console.log('  ' + chalk.hex(theme.dim)('Selected: ') + chalk.hex(theme.primary)(basename(selectedFile)));
      console.log('  ' + chalk.hex(theme.dim)(dirname(selectedFile)));
      console.log();
      
      choices.push(
        { 
          name: chalk.hex(theme.success)('🔨 Compile'), 
          value: 'compile',
          description: 'Compile DSL to CSV'
        },
        { 
          name: chalk.blue('✓  Validate'), 
          value: 'check',
          description: 'Check for errors'
        },
        { 
          name: chalk.hex(theme.primary)('ℹ  Info'), 
          value: 'info',
          description: 'Show program details'
        },
        {
          name: chalk.hex(theme.warning)(`${symbols.watch} Watch`),
          value: 'watch',
          description: 'Auto-recompile on changes'
        },
        { name: chalk.hex(theme.dim)('─'.repeat(30)), value: '__SEP1__', disabled: true } as any,
        { 
          name: chalk.yellow(`${symbols.folder} Change file`), 
          value: 'browse',
          description: 'Select a different file'
        },
      );
    } else {
      choices.push(
        { 
          name: chalk.hex(theme.primary)(`${symbols.folder} Open file`), 
          value: 'browse',
          description: 'Browse for DSL file'
        },
      );
    }
    
    // Recent files (if any and no file selected)
    if (!selectedFile && recentFiles.length > 0) {
      choices.push(
        {
          name: chalk.hex(theme.secondary)(`${symbols.clock} Recent files`) + 
                chalk.hex(theme.dim)(` (${recentFiles.length})`),
          value: 'recent',
          description: 'Open a recent file'
        },
      );
    }
    
    choices.push({ name: chalk.hex(theme.dim)('─'.repeat(30)), value: '__SEP2__', disabled: true } as any);
    choices.push({ 
      name: chalk.hex(theme.accent)(`${symbols.gear} Settings`), 
      value: 'settings',
      description: 'Configure OpenEdge'
    });
    choices.push({ 
      name: chalk.red('✕  Exit'), 
      value: 'exit',
      description: 'Quit OpenEdge'
    });
    
    const action = await select({
      message: 'What would you like to do?',
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
          // Watch mode exits with Ctrl+C
        }
        break;
        
      case 'settings':
        await showSettingsMenu();
        clearScreen();
        printWelcome();
        break;
        
      case 'exit':
        console.log();
        console.log('  ' + chalk.hex(theme.dim)('Goodbye! 👋'));
        console.log();
        process.exit(0);
    }
  }
}
