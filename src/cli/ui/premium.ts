/**
 * Premium UI components for CLI
 * Inspired by OpenCode, Claude CLI, Gemini CLI
 * With dynamic theme support
 */

import chalk from 'chalk';
import gradient from 'gradient-string';
import boxen from 'boxen';
import ora, { Ora } from 'ora';
import { getCurrentTheme, Theme } from '../config/store.js';

// Get current theme and create gradients
function getThemeGradients() {
  const theme = getCurrentTheme();
  return {
    brand: gradient([theme.primary, theme.secondary]),
    success: gradient([theme.success, theme.primary]),
    error: gradient([theme.error, theme.warning]),
    subtle: gradient([theme.accent, theme.primary]),
    theme,
  };
}

// Symbols (static)
export const symbols = {
  success: '✓',
  error: '✗',
  warning: '⚠',
  info: 'ℹ',
  arrow: '→',
  bullet: '•',
  pointer: '❯',
  line: '│',
  corner: '└',
  dash: '─',
  watch: '👁',
  file: '📄',
  folder: '📁',
  gear: '⚙',
  palette: '🎨',
  clock: '🕐',
  sparkle: '✨',
};

// Get themed symbols
export function getThemedSymbols() {
  const theme = getCurrentTheme();
  return {
    success: chalk.hex(theme.success)(symbols.success),
    error: chalk.hex(theme.error)(symbols.error),
    warning: chalk.hex(theme.warning)(symbols.warning),
    info: chalk.hex(theme.primary)(symbols.info),
    arrow: chalk.hex(theme.primary)(symbols.arrow),
    bullet: chalk.hex(theme.dim)(symbols.bullet),
    pointer: chalk.hex(theme.primary)(symbols.pointer),
    line: chalk.hex(theme.dim)(symbols.line),
    corner: chalk.hex(theme.dim)(symbols.corner),
    dash: chalk.hex(theme.dim)(symbols.dash),
  };
}

/**
 * ASCII Art Logo with gradient
 */
export function printLogo(): void {
  const { brand, subtle } = getThemeGradients();
  
  const logo = `
   ██████╗ ██████╗ ███████╗███╗   ██╗███████╗██████╗  ██████╗ ███████╗
  ██╔═══██╗██╔══██╗██╔════╝████╗  ██║██╔════╝██╔══██╗██╔════╝ ██╔════╝
  ██║   ██║██████╔╝█████╗  ██╔██╗ ██║█████╗  ██║  ██║██║  ███╗█████╗  
  ██║   ██║██╔═══╝ ██╔══╝  ██║╚██╗██║██╔══╝  ██║  ██║██║   ██║██╔══╝  
  ╚██████╔╝██║     ███████╗██║ ╚████║███████╗██████╔╝╚██████╔╝███████╗
   ╚═════╝ ╚═╝     ╚══════╝╚═╝  ╚═══╝╚══════╝╚═════╝  ╚═════╝ ╚══════╝`;

  console.log(brand.multiline(logo));
  console.log();
  console.log(chalk.dim('                      ') + subtle('DSL Compiler for CGRA'));
  console.log();
}

/**
 * Print a smaller inline logo
 */
export function printInlineLogo(): void {
  const { brand } = getThemeGradients();
  console.log();
  console.log('  ' + brand('OpenEdge') + chalk.dim(' DSL Compiler v0.1.0'));
  console.log();
}

/**
 * Create a spinner with custom styling
 */
export function createSpinner(text: string): Ora {
  const theme = getCurrentTheme();
  return ora({
    text: chalk.hex(theme.dim)(text),
    spinner: 'dots12',
    color: 'cyan',
  });
}

/**
 * Print a boxed message
 */
export function printBox(content: string, title?: string): void {
  const theme = getCurrentTheme();
  console.log(boxen(content, {
    padding: 1,
    margin: { top: 0, bottom: 1, left: 2, right: 2 },
    borderStyle: 'round',
    borderColor: theme.primary as any,
    title: title,
    titleAlignment: 'left',
  }));
}

/**
 * Print success message with style
 */
export function printSuccess(message: string, details?: string): void {
  const { success } = getThemeGradients();
  const syms = getThemedSymbols();
  console.log();
  console.log('  ' + syms.success + ' ' + success(message));
  if (details) {
    console.log('    ' + chalk.dim(details));
  }
}

/**
 * Print error message with style
 */
export function printError(message: string, details?: string): void {
  const { error } = getThemeGradients();
  const syms = getThemedSymbols();
  console.log();
  console.log('  ' + syms.error + ' ' + error(message));
  if (details) {
    console.log('    ' + chalk.dim(details));
  }
}

/**
 * Print warning message
 */
export function printWarning(message: string, details?: string): void {
  const theme = getCurrentTheme();
  const syms = getThemedSymbols();
  console.log();
  console.log('  ' + syms.warning + ' ' + chalk.hex(theme.warning)(message));
  if (details) {
    console.log('    ' + chalk.dim(details));
  }
}

/**
 * Print info message
 */
export function printInfo(message: string): void {
  const theme = getCurrentTheme();
  const syms = getThemedSymbols();
  console.log('  ' + syms.info + ' ' + chalk.hex(theme.primary)(message));
}

/**
 * Print a section header
 */
export function printHeader(text: string): void {
  const theme = getCurrentTheme();
  console.log();
  console.log('  ' + chalk.bold.white(text));
  console.log('  ' + chalk.hex(theme.dim)('─'.repeat(text.length + 2)));
}

/**
 * Print a key-value pair
 */
export function printKeyValue(key: string, value: string | number, indent: number = 4): void {
  const theme = getCurrentTheme();
  const spaces = ' '.repeat(indent);
  console.log(spaces + chalk.hex(theme.dim)(key.padEnd(14)) + chalk.white(String(value)));
}

/**
 * Print a labeled stat with color
 */
export function printStat(label: string, value: string | number, color: 'success' | 'primary' | 'warning' | 'white' = 'white'): void {
  const theme = getCurrentTheme();
  const colorMap = {
    success: theme.success,
    primary: theme.primary,
    warning: theme.warning,
    white: '#ffffff',
  };
  
  console.log('    ' + chalk.hex(theme.dim)(label.padEnd(14)) + chalk.hex(colorMap[color])(String(value)));
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
  const theme = getCurrentTheme();
  console.log();
  
  if (stats.output) {
    printStat('Output', stats.output, 'primary');
  }
  if (stats.cycles !== undefined) {
    printStat('Cycles', stats.cycles, 'success');
  }
  if (stats.grid) {
    printStat('Grid', `${stats.grid.width}×${stats.grid.height}`, 'white');
  }
  if (stats.memoryRegions !== undefined) {
    printStat('Memory', `${stats.memoryRegions} region${stats.memoryRegions !== 1 ? 's' : ''}`, 'white');
  }
  if (stats.assertions !== undefined && stats.assertions > 0) {
    printStat('Assertions', stats.assertions, 'warning');
  }
  
  console.log();
  
  if (stats.time !== undefined) {
    console.log('  ' + chalk.hex(theme.dim)(`Completed in ${stats.time.toFixed(0)}ms`));
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
  const theme = getCurrentTheme();
  const syms = getThemedSymbols();
  const lines = source.split('\n');
  const startLine = Math.max(0, line - 3);
  const endLine = Math.min(lines.length, line + 2);
  
  console.log();
  
  // File location
  if (filePath) {
    console.log('    ' + chalk.hex(theme.primary).underline(`${filePath}:${line}:${column}`));
    console.log();
  }

  // Code context
  for (let i = startLine; i < endLine; i++) {
    const lineNum = i + 1;
    const isErrorLine = lineNum === line;
    const lineNumStr = String(lineNum).padStart(5);
    
    if (isErrorLine) {
      // Error line with marker
      console.log('  ' + chalk.hex(theme.error)('>') + ' ' + chalk.hex(theme.error)(lineNumStr) + ' ' + syms.line + ' ' + lines[i]);
      
      // Underline the error position
      const spaces = ' '.repeat(column - 1);
      console.log('          ' + syms.line + ' ' + spaces + chalk.hex(theme.error)('^^'));
    } else {
      // Context line
      console.log('    ' + chalk.hex(theme.dim)(lineNumStr) + ' ' + syms.line + ' ' + chalk.hex(theme.dim)(lines[i]));
    }
  }
  
  console.log();
  console.log('    ' + chalk.hex(theme.error).bold('Error: ') + chalk.white(message));
  console.log();
}

/**
 * Print welcome message for interactive mode
 */
export function printWelcome(): void {
  const theme = getCurrentTheme();
  console.clear();
  printLogo();
  
  console.log(boxen(
    chalk.hex(theme.dim)('Use ') + chalk.hex(theme.primary)('↑↓') + chalk.hex(theme.dim)(' to navigate, ') +
    chalk.hex(theme.primary)('Enter') + chalk.hex(theme.dim)(' to select, ') +
    chalk.hex(theme.primary)('Ctrl+C') + chalk.hex(theme.dim)(' to exit'),
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
  const theme = getCurrentTheme();
  console.log('  ' + chalk.hex(theme.dim)('─'.repeat(50)));
}

/**
 * Print file info badge
 */
export function printFileBadge(filePath: string): void {
  const theme = getCurrentTheme();
  console.log();
  console.log('  ' + chalk.bgHex(theme.primary).black(' FILE ') + ' ' + chalk.hex(theme.primary)(filePath));
}

/**
 * Print status badge
 */
export function printStatusBadge(status: 'valid' | 'invalid' | 'compiling' | 'watching'): void {
  const theme = getCurrentTheme();
  const badges = {
    valid: chalk.bgHex(theme.success).black(' VALID '),
    invalid: chalk.bgHex(theme.error).white(' INVALID '),
    compiling: chalk.bgHex(theme.warning).black(' COMPILING '),
    watching: chalk.bgHex(theme.primary).black(' WATCHING '),
  };
  console.log('  ' + badges[status]);
}

/**
 * Print theme preview
 */
export function printThemePreview(themeName: string, theme: Theme): void {
  const { brand } = getThemeGradients();
  
  console.log();
  console.log('  ' + chalk.bold(theme.name));
  console.log('  ' + chalk.hex(theme.dim)('─'.repeat(20)));
  console.log('  ' + chalk.hex(theme.primary)('■') + ' Primary   ' + 
              chalk.hex(theme.secondary)('■') + ' Secondary');
  console.log('  ' + chalk.hex(theme.success)('■') + ' Success   ' + 
              chalk.hex(theme.error)('■') + ' Error');
  console.log('  ' + chalk.hex(theme.warning)('■') + ' Warning   ' + 
              chalk.hex(theme.accent)('■') + ' Accent');
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

/**
 * Print recent files list
 */
export function printRecentFiles(files: { path: string; accessCount: number }[]): void {
  const theme = getCurrentTheme();
  
  if (files.length === 0) {
    console.log('  ' + chalk.hex(theme.dim)('No recent files'));
    return;
  }
  
  files.forEach((file, index) => {
    const num = chalk.hex(theme.dim)(`${index + 1}.`);
    const path = chalk.hex(theme.primary)(file.path);
    const count = chalk.hex(theme.dim)(`(${file.accessCount}×)`);
    console.log(`  ${num} ${path} ${count}`);
  });
}

export { chalk, gradient, ora };
