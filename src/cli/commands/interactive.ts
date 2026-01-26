/**
 * Premium Interactive Mode
 * Inspired by OpenCode, Claude CLI, Gemini CLI
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
  createSpinner,
  clearScreen,
  chalk,
  symbols,
} from '../ui/premium.js';

// Store state
let lastDirectory = process.cwd();
let selectedFile: string | null = null;

/**
 * Custom theme for inquirer
 */
const theme = {
  prefix: chalk.cyan('❯'),
  spinner: {
    interval: 80,
    frames: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'].map(f => chalk.cyan(f)),
  },
  style: {
    answer: chalk.cyan,
    message: chalk.bold.white,
    error: chalk.red,
    help: chalk.dim,
    highlight: chalk.cyan,
    key: chalk.cyan.bold,
  },
};

/**
 * Browse for a DSL file with premium UI
 */
async function browseForFile(): Promise<string | null> {
  let currentDir = lastDirectory;
  
  while (true) {
    clearScreen();
    printHeader('📂 File Browser');
    console.log('  ' + chalk.dim('Location: ') + chalk.cyan(currentDir));
    console.log();
    
    const entries = readdirSync(currentDir);
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
        name: chalk.dim('..') + chalk.dim(' (parent)'), 
        value: '__PARENT__' 
      });
    }
    
    // Directories first
    dirs.forEach(d => {
      choices.push({ 
        name: chalk.blue('📁 ') + chalk.blue(d), 
        value: `__DIR__:${d}` 
      });
    });
    
    // DSL files
    dslFiles.forEach(f => {
      choices.push({ 
        name: chalk.green('📄 ') + chalk.white(f), 
        value: join(currentDir, f),
        description: 'DSL source file'
      });
    });
    
    // Options
    choices.push({ name: chalk.dim('─'.repeat(30)), value: '__SEP__', disabled: true } as any);
    choices.push({ name: chalk.yellow('✏️  Enter path manually'), value: '__MANUAL__' });
    choices.push({ name: chalk.red('← Back to menu'), value: '__CANCEL__' });
    
    const selection = await select({
      message: 'Select a file or directory',
      choices,
      pageSize: 15,
      theme,
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
        theme,
      });
      if (existsSync(manualPath)) {
        lastDirectory = dirname(resolve(manualPath));
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
    lastDirectory = dirname(selection);
    return selection;
  }
}

/**
 * Compile action with spinner
 */
async function doCompile(filePath: string): Promise<void> {
  clearScreen();
  printHeader('🔨 Compile');
  printFileBadge(getRelativePath(filePath));
  console.log();
  
  const spinner = createSpinner('Reading source file...');
  spinner.start();
  
  const startTime = performance.now();
  
  // Simulate slight delay for effect
  await new Promise(r => setTimeout(r, 300));
  
  const readResult = readFile(filePath);
  if (!readResult.success) {
    spinner.fail(chalk.red('Failed to read file'));
    printError('Read Error', readResult.error);
    return;
  }
  
  spinner.text = 'Compiling...';
  await new Promise(r => setTimeout(r, 200));
  
  const result = compileDslToCsv(readResult.content!);
  
  if (result.success) {
    spinner.text = 'Writing output...';
    
    const defaultOutput = getOutputPath(filePath);
    
    spinner.stop();
    console.log();
    
    const outputPath = await input({
      message: 'Output file',
      default: defaultOutput,
      theme,
    });
    
    const writeSpinner = createSpinner('Writing CSV...');
    writeSpinner.start();
    
    await new Promise(r => setTimeout(r, 200));
    
    const writeResult = writeFile(outputPath, result.csv!);
    if (!writeResult.success) {
      writeSpinner.fail(chalk.red('Failed to write file'));
      printError('Write Error', writeResult.error);
      return;
    }
    
    const endTime = performance.now();
    writeSpinner.succeed(chalk.green('Compiled successfully'));
    
    printCompilationStats({
      output: getRelativePath(outputPath),
      cycles: result.maxCycles,
      grid: result.suggestedGridSize,
      memoryRegions: result.memoryRegions?.length || 0,
      assertions: result.assertions?.length || 0,
      time: endTime - startTime,
    });
  } else {
    spinner.fail(chalk.red('Compilation failed'));
    
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
  clearScreen();
  printHeader('✅ Validate');
  printFileBadge(getRelativePath(filePath));
  console.log();
  
  const spinner = createSpinner('Validating syntax...');
  spinner.start();
  
  await new Promise(r => setTimeout(r, 400));
  
  const readResult = readFile(filePath);
  if (!readResult.success) {
    spinner.fail(chalk.red('Failed to read file'));
    printError('Read Error', readResult.error);
    return;
  }
  
  const result = compileDslToCsv(readResult.content!);
  
  if (result.success) {
    spinner.succeed(chalk.green('No errors found'));
    console.log();
    printKeyValue('Cycles', result.maxCycles || 0);
    printKeyValue('Memory regions', result.memoryRegions?.length || 0);
    if (result.assertions && result.assertions.length > 0) {
      printKeyValue('Assertions', result.assertions.length);
    }
  } else {
    spinner.fail(chalk.red('Validation failed'));
    
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
  clearScreen();
  printHeader('ℹ️  Program Info');
  printFileBadge(getRelativePath(filePath));
  console.log();
  
  const spinner = createSpinner('Analyzing program...');
  spinner.start();
  
  await new Promise(r => setTimeout(r, 400));
  
  const readResult = readFile(filePath);
  if (!readResult.success) {
    spinner.fail(chalk.red('Failed to read file'));
    printError('Read Error', readResult.error);
    return;
  }
  
  const result = compileDslToCsv(readResult.content!);
  
  spinner.stop();
  console.log();
  
  if (result.success) {
    console.log('  ' + chalk.bgGreen.black(' VALID '));
    console.log();
    
    printKeyValue('Status', chalk.green('Valid'));
    
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
        const name = region.name || chalk.dim('anonymous');
        const addr = chalk.cyan(`0x${region.start.toString(16).toUpperCase()}`);
        console.log(`    ${chalk.dim('•')} ${name} ${chalk.dim('at')} ${addr} ${chalk.dim(`(${region.values.length} values)`)}`);
      });
    }
    
    if (result.assertions && result.assertions.length > 0) {
      console.log();
      printHeader('Assertions');
      printKeyValue('Count', result.assertions.length);
    }
    
    if (result.ioConfig) {
      console.log();
      printHeader('I/O Configuration');
      if (result.ioConfig.loadAddrs.length > 0) {
        printKeyValue('Load addresses', result.ioConfig.loadAddrs.map(a => `0x${a.toString(16)}`).join(', '));
      }
      if (result.ioConfig.storeAddrs.length > 0) {
        printKeyValue('Store addresses', result.ioConfig.storeAddrs.map(a => `0x${a.toString(16)}`).join(', '));
      }
    }
  } else {
    console.log('  ' + chalk.bgRed.white(' INVALID '));
    console.log();
    printKeyValue('Status', chalk.red('Invalid'));
    printKeyValue('Error', result.error || 'Unknown');
    if (result.line) {
      printKeyValue('Line', result.line);
    }
  }
}

/**
 * Wait for keypress
 */
async function waitForKey(): Promise<void> {
  console.log();
  console.log('  ' + chalk.dim('Press Enter to continue...'));
  await input({ message: '', theme: { ...theme, prefix: '' } });
}

/**
 * Main interactive loop with premium UI
 */
export async function runInteractiveMode(): Promise<void> {
  printWelcome();
  
  while (true) {
    // Build menu
    const choices: { name: string; value: string; description?: string }[] = [];
    
    if (selectedFile) {
      // Show current file
      console.log();
      console.log('  ' + chalk.dim('Selected: ') + chalk.cyan(basename(selectedFile)));
      console.log('  ' + chalk.dim(dirname(selectedFile)));
      console.log();
      
      choices.push(
        { 
          name: chalk.green('🔨 Compile'), 
          value: 'compile',
          description: 'Compile DSL to CSV'
        },
        { 
          name: chalk.blue('✓  Validate'), 
          value: 'check',
          description: 'Check for errors'
        },
        { 
          name: chalk.cyan('ℹ  Info'), 
          value: 'info',
          description: 'Show program details'
        },
        { name: chalk.dim('─'.repeat(30)), value: '__SEP__', disabled: true } as any,
        { 
          name: chalk.yellow('📂 Change file'), 
          value: 'browse',
          description: 'Select a different file'
        },
      );
    } else {
      choices.push(
        { 
          name: chalk.cyan('📂 Open file'), 
          value: 'browse',
          description: 'Browse for DSL file'
        },
      );
    }
    
    choices.push({ name: chalk.dim('─'.repeat(30)), value: '__SEP2__', disabled: true } as any);
    choices.push({ 
      name: chalk.red('✕  Exit'), 
      value: 'exit',
      description: 'Quit OpenEdge'
    });
    
    const action = await select({
      message: 'What would you like to do?',
      choices,
      theme,
    });
    
    switch (action) {
      case 'browse':
        selectedFile = await browseForFile();
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
        
      case 'exit':
        console.log();
        console.log('  ' + chalk.dim('Goodbye! 👋'));
        console.log();
        process.exit(0);
    }
  }
}
