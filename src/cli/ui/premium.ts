/**
 * Premium UI components for CLI
 * Inspired by OpenCode, Claude CLI, Gemini CLI
 */

import chalk from 'chalk';
import gradient from 'gradient-string';
import boxen from 'boxen';
import ora, { Ora } from 'ora';

// Custom gradients
const brandGradient = gradient(['#00d9ff', '#00ff87']);
const successGradient = gradient(['#00ff87', '#00d9ff']);
const errorGradient = gradient(['#ff6b6b', '#ffa502']);
const subtleGradient = gradient(['#667eea', '#764ba2']);

// Symbols
export const symbols = {
  success: chalk.green('✓'),
  error: chalk.red('✗'),
  warning: chalk.yellow('⚠'),
  info: chalk.cyan('ℹ'),
  arrow: chalk.cyan('→'),
  bullet: chalk.dim('•'),
  pointer: chalk.cyan('❯'),
  line: chalk.dim('│'),
  corner: chalk.dim('└'),
  dash: chalk.dim('─'),
};

/**
 * ASCII Art Logo with gradient
 */
export function printLogo(): void {
  const logo = `
   ██████╗ ██████╗ ███████╗███╗   ██╗███████╗██████╗  ██████╗ ███████╗
  ██╔═══██╗██╔══██╗██╔════╝████╗  ██║██╔════╝██╔══██╗██╔════╝ ██╔════╝
  ██║   ██║██████╔╝█████╗  ██╔██╗ ██║█████╗  ██║  ██║██║  ███╗█████╗  
  ██║   ██║██╔═══╝ ██╔══╝  ██║╚██╗██║██╔══╝  ██║  ██║██║   ██║██╔══╝  
  ╚██████╔╝██║     ███████╗██║ ╚████║███████╗██████╔╝╚██████╔╝███████╗
   ╚═════╝ ╚═╝     ╚══════╝╚═╝  ╚═══╝╚══════╝╚═════╝  ╚═════╝ ╚══════╝`;

  console.log(brandGradient.multiline(logo));
  console.log();
  console.log(chalk.dim('                      ') + subtleGradient('DSL Compiler for CGRA'));
  console.log();
}

/**
 * Print a smaller inline logo
 */
export function printInlineLogo(): void {
  console.log();
  console.log('  ' + brandGradient('OpenEdge') + chalk.dim(' DSL Compiler v0.1.0'));
  console.log();
}

/**
 * Create a spinner with custom styling
 */
export function createSpinner(text: string): Ora {
  return ora({
    text: chalk.dim(text),
    spinner: 'dots12',
    color: 'cyan',
  });
}

/**
 * Print a boxed message
 */
export function printBox(content: string, title?: string): void {
  console.log(boxen(content, {
    padding: 1,
    margin: { top: 0, bottom: 1, left: 2, right: 2 },
    borderStyle: 'round',
    borderColor: 'cyan',
    title: title,
    titleAlignment: 'left',
  }));
}

/**
 * Print success message with style
 */
export function printSuccess(message: string, details?: string): void {
  console.log();
  console.log('  ' + symbols.success + ' ' + successGradient(message));
  if (details) {
    console.log('    ' + chalk.dim(details));
  }
}

/**
 * Print error message with style
 */
export function printError(message: string, details?: string): void {
  console.log();
  console.log('  ' + symbols.error + ' ' + errorGradient(message));
  if (details) {
    console.log('    ' + chalk.dim(details));
  }
}

/**
 * Print info message
 */
export function printInfo(message: string): void {
  console.log('  ' + symbols.info + ' ' + chalk.cyan(message));
}

/**
 * Print a section header
 */
export function printHeader(text: string): void {
  console.log();
  console.log('  ' + chalk.bold.white(text));
  console.log('  ' + chalk.dim('─'.repeat(text.length + 2)));
}

/**
 * Print a key-value pair
 */
export function printKeyValue(key: string, value: string | number, indent: number = 4): void {
  const spaces = ' '.repeat(indent);
  console.log(spaces + chalk.dim(key.padEnd(14)) + chalk.white(value));
}

/**
 * Print a labeled stat with color
 */
export function printStat(label: string, value: string | number, color: 'green' | 'cyan' | 'yellow' | 'white' = 'white'): void {
  const colorFn = {
    green: chalk.green,
    cyan: chalk.cyan,
    yellow: chalk.yellow,
    white: chalk.white,
  }[color];
  
  console.log('    ' + chalk.dim(label.padEnd(14)) + colorFn(value));
}

/**
 * Print compilation stats in a nice format
 */
export function printCompilationStats(stats: {
  output?: string;
  cycles?: number;
  grid?: { width: number; height: number };
  memoryRegions?: number;
  assertions?: number;
  time?: number;
}): void {
  console.log();
  
  if (stats.output) {
    printStat('Output', stats.output, 'cyan');
  }
  if (stats.cycles !== undefined) {
    printStat('Cycles', stats.cycles, 'green');
  }
  if (stats.grid) {
    printStat('Grid', `${stats.grid.width}×${stats.grid.height}`, 'white');
  }
  if (stats.memoryRegions !== undefined) {
    printStat('Memory', `${stats.memoryRegions} region${stats.memoryRegions !== 1 ? 's' : ''}`, 'white');
  }
  if (stats.assertions !== undefined && stats.assertions > 0) {
    printStat('Assertions', stats.assertions, 'yellow');
  }
  
  console.log();
  
  if (stats.time !== undefined) {
    console.log('  ' + chalk.dim(`Completed in ${stats.time.toFixed(0)}ms`));
  }
}

/**
 * Print a code frame with syntax highlighting
 */
export function printCodeFrame(
  source: string,
  line: number,
  column: number,
  message: string,
  filePath?: string
): void {
  const lines = source.split('\n');
  const startLine = Math.max(0, line - 3);
  const endLine = Math.min(lines.length, line + 2);
  
  console.log();
  
  // File location
  if (filePath) {
    console.log('    ' + chalk.cyan.underline(`${filePath}:${line}:${column}`));
    console.log();
  }

  // Code context
  for (let i = startLine; i < endLine; i++) {
    const lineNum = i + 1;
    const isErrorLine = lineNum === line;
    const lineNumStr = String(lineNum).padStart(5);
    
    if (isErrorLine) {
      // Error line with marker
      console.log('  ' + chalk.red('>') + ' ' + chalk.red(lineNumStr) + ' ' + symbols.line + ' ' + lines[i]);
      
      // Underline the error position
      const spaces = ' '.repeat(column - 1);
      console.log('          ' + symbols.line + ' ' + spaces + chalk.red('^^'));
    } else {
      // Context line
      console.log('    ' + chalk.dim(lineNumStr) + ' ' + symbols.line + ' ' + chalk.dim(lines[i]));
    }
  }
  
  console.log();
  console.log('    ' + chalk.red.bold('Error: ') + chalk.white(message));
  console.log();
}

/**
 * Print welcome message for interactive mode
 */
export function printWelcome(): void {
  console.clear();
  printLogo();
  
  console.log(boxen(
    chalk.dim('Use ') + chalk.cyan('↑↓') + chalk.dim(' to navigate, ') +
    chalk.cyan('Enter') + chalk.dim(' to select, ') +
    chalk.cyan('Ctrl+C') + chalk.dim(' to exit'),
    {
      padding: { top: 0, bottom: 0, left: 1, right: 1 },
      margin: { top: 0, bottom: 1, left: 2, right: 2 },
      borderStyle: 'round',
      borderColor: 'gray',
      dimBorder: true,
    }
  ));
}

/**
 * Print a divider line
 */
export function printDivider(): void {
  console.log('  ' + chalk.dim('─'.repeat(50)));
}

/**
 * Print file info badge
 */
export function printFileBadge(filePath: string): void {
  console.log();
  console.log('  ' + chalk.bgCyan.black(' FILE ') + ' ' + chalk.cyan(filePath));
}

/**
 * Print status badge
 */
export function printStatusBadge(status: 'valid' | 'invalid' | 'compiling'): void {
  const badges = {
    valid: chalk.bgGreen.black(' VALID '),
    invalid: chalk.bgRed.white(' INVALID '),
    compiling: chalk.bgYellow.black(' COMPILING '),
  };
  console.log('  ' + badges[status]);
}

/**
 * Animate text typing effect (for dramatic effect)
 */
export async function typeText(text: string, speed: number = 30): Promise<void> {
  for (const char of text) {
    process.stdout.write(char);
    await new Promise(resolve => setTimeout(resolve, speed));
  }
  console.log();
}

/**
 * Clear screen and reset cursor
 */
export function clearScreen(): void {
  console.clear();
}

export { chalk, gradient, ora };
