/**
 * Interactive mode - menu-driven CLI interface
 */

import { select, input, confirm } from '@inquirer/prompts';
import { existsSync, readdirSync, statSync } from 'fs';
import { join, dirname, basename, resolve } from 'path';
import { compileDslToCsv } from '../../compiler.js';
import { logger } from '../utils/logger.js';
import { readFile, writeFile, getOutputPath, getRelativePath } from '../utils/files.js';

// Store last used directory for convenience
let lastDirectory = process.cwd();

/**
 * Find .dsl files in a directory
 */
function findDslFiles(dir: string): string[] {
  try {
    const files = readdirSync(dir);
    return files
      .filter(f => f.endsWith('.dsl'))
      .map(f => join(dir, f));
  } catch {
    return [];
  }
}

/**
 * Browse for a DSL file
 */
async function browseForFile(): Promise<string | null> {
  let currentDir = lastDirectory;
  
  while (true) {
    const entries = readdirSync(currentDir);
    const dirs = entries.filter(e => {
      try {
        return statSync(join(currentDir, e)).isDirectory() && !e.startsWith('.');
      } catch {
        return false;
      }
    });
    const dslFiles = entries.filter(e => e.endsWith('.dsl'));
    
    const choices: { name: string; value: string }[] = [];
    
    // Add parent directory option
    if (currentDir !== '/') {
      choices.push({ name: '📁 ..', value: '__PARENT__' });
    }
    
    // Add directories
    dirs.forEach(d => {
      choices.push({ name: `📁 ${d}/`, value: `__DIR__:${d}` });
    });
    
    // Add DSL files
    dslFiles.forEach(f => {
      choices.push({ name: `📄 ${f}`, value: join(currentDir, f) });
    });
    
    // Add manual input option
    choices.push({ name: '✏️  Enter path manually...', value: '__MANUAL__' });
    choices.push({ name: '❌ Cancel', value: '__CANCEL__' });
    
    console.log();
    logger.dim(`Current: ${currentDir}`);
    
    const selection = await select({
      message: 'Select a DSL file:',
      choices,
      pageSize: 15,
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
      });
      if (existsSync(manualPath)) {
        lastDirectory = dirname(resolve(manualPath));
        return resolve(manualPath);
      } else {
        logger.error(`File not found: ${manualPath}`);
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
 * Compile action
 */
async function doCompile(filePath: string): Promise<void> {
  const startTime = performance.now();
  
  const readResult = readFile(filePath);
  if (!readResult.success) {
    logger.error(readResult.error!);
    return;
  }
  
  const result = compileDslToCsv(readResult.content!);
  
  if (result.success) {
    // Ask for output path
    const defaultOutput = getOutputPath(filePath);
    const outputPath = await input({
      message: 'Output file:',
      default: defaultOutput,
    });
    
    const writeResult = writeFile(outputPath, result.csv!);
    if (!writeResult.success) {
      logger.error(writeResult.error!);
      return;
    }
    
    const endTime = performance.now();
    logger.success('Compiled successfully');
    logger.stats({
      output: getRelativePath(outputPath),
      cycles: result.maxCycles,
      grid: result.suggestedGridSize,
      memoryRegions: result.memoryRegions?.length || 0,
      assertions: result.assertions?.length || 0,
      time: endTime - startTime,
    });
  } else {
    logger.error('Compilation failed');
    if (result.line && readResult.content) {
      logger.codeFrame(
        readResult.content,
        result.line,
        1,
        result.error || 'Unknown error',
        getRelativePath(filePath)
      );
    } else {
      logger.newline();
      logger.dim(`  ${result.error}`);
      logger.newline();
    }
  }
}

/**
 * Check action
 */
async function doCheck(filePath: string): Promise<void> {
  const readResult = readFile(filePath);
  if (!readResult.success) {
    logger.error(readResult.error!);
    return;
  }
  
  const result = compileDslToCsv(readResult.content!);
  const relativePath = getRelativePath(filePath);
  
  if (result.success) {
    logger.success(`${relativePath}: No errors found`);
    if (result.maxCycles) {
      logger.dim(`  ${result.maxCycles} cycles, ${result.memoryRegions?.length || 0} memory regions`);
    }
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
  }
}

/**
 * Info action
 */
async function doInfo(filePath: string): Promise<void> {
  const readResult = readFile(filePath);
  if (!readResult.success) {
    logger.error(readResult.error!);
    return;
  }
  
  const result = compileDslToCsv(readResult.content!);
  const relativePath = getRelativePath(filePath);
  
  console.log();
  
  if (result.success) {
    logger.success(`Program: ${relativePath}`);
    console.log();
    logger.property('Status', 'Valid');
    
    if (result.maxCycles !== undefined) {
      logger.property('Cycles', result.maxCycles);
    }
    
    if (result.suggestedGridSize) {
      logger.property('Grid', `${result.suggestedGridSize.width}×${result.suggestedGridSize.height}`);
    }
    
    if (result.memoryRegions && result.memoryRegions.length > 0) {
      logger.property('Memory', `${result.memoryRegions.length} region(s)`);
      result.memoryRegions.forEach(region => {
        const name = region.name || 'anonymous';
        const addr = `0x${region.start.toString(16).toUpperCase()}`;
        logger.dim(`        ${name}: ${addr} (${region.values.length} values)`);
      });
    }
    
    if (result.assertions && result.assertions.length > 0) {
      logger.property('Assertions', result.assertions.length);
    }
    
    if (result.ioConfig) {
      if (result.ioConfig.loadAddrs.length > 0) {
        logger.property('Load addrs', result.ioConfig.loadAddrs.map(a => `0x${a.toString(16)}`).join(', '));
      }
      if (result.ioConfig.storeAddrs.length > 0) {
        logger.property('Store addrs', result.ioConfig.storeAddrs.map(a => `0x${a.toString(16)}`).join(', '));
      }
    }
  } else {
    logger.error(`Program: ${relativePath}`);
    console.log();
    logger.property('Status', 'Invalid');
    logger.property('Error', result.error || 'Unknown');
    if (result.line) {
      logger.property('Line', result.line);
    }
  }
  
  console.log();
}

/**
 * Main interactive loop
 */
export async function runInteractiveMode(): Promise<void> {
  console.log();
  console.log('  ╔═══════════════════════════════════════╗');
  console.log('  ║                                       ║');
  console.log('  ║   🔧 OpenEdge-DSL Interactive Mode    ║');
  console.log('  ║                                       ║');
  console.log('  ╚═══════════════════════════════════════╝');
  console.log();
  
  let selectedFile: string | null = null;
  
  while (true) {
    // Build menu choices
    const choices: { name: string; value: string; description?: string }[] = [];
    
    if (selectedFile) {
      choices.push(
        { name: '🔨 Compile', value: 'compile', description: 'Compile to CSV' },
        { name: '✅ Check', value: 'check', description: 'Validate syntax' },
        { name: 'ℹ️  Info', value: 'info', description: 'Show program details' },
        { name: '📄 Change file', value: 'browse', description: 'Select different file' },
      );
    } else {
      choices.push(
        { name: '📂 Open file', value: 'browse', description: 'Browse for DSL file' },
      );
    }
    
    choices.push(
      { name: '❌ Exit', value: 'exit', description: 'Quit interactive mode' },
    );
    
    // Show current file if selected
    if (selectedFile) {
      console.log();
      logger.info(`Selected: ${getRelativePath(selectedFile)}`);
    }
    
    const action = await select({
      message: 'What would you like to do?',
      choices,
    });
    
    switch (action) {
      case 'browse':
        selectedFile = await browseForFile();
        break;
        
      case 'compile':
        if (selectedFile) await doCompile(selectedFile);
        break;
        
      case 'check':
        if (selectedFile) await doCheck(selectedFile);
        break;
        
      case 'info':
        if (selectedFile) await doInfo(selectedFile);
        break;
        
      case 'exit':
        console.log();
        logger.dim('  Goodbye! 👋');
        console.log();
        return;
    }
    
    // Pause before showing menu again
    if (action !== 'browse' && action !== 'exit') {
      await confirm({ message: 'Continue?', default: true });
    }
  }
}
