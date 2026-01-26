/**
 * Premium UI components for CLI
 * Clean, minimal design inspired by Claude Code and OpenCode
 * No emojis - pure Unicode symbols and typography
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

// Clean Unicode symbols - no emojis
export const symbols = {
  // Status
  success: '✓',
  error: '✗',
  warning: '!',
  info: '●',
  
  // Navigation
  arrow: '→',
  arrowRight: '▸',
  arrowDown: '▾',
  pointer: '❯',
  
  // Structure
  line: '│',
  corner: '└',
  tee: '├',
  dash: '─',
  dot: '·',
  bullet: '•',
  
  // Actions
  play: '▶',
  pause: '⏸',
  stop: '■',
  refresh: '↻',
  
  // Objects
  file: '◇',
  fileActive: '◆',
  folder: '▪',
  folderOpen: '▫',
  
  // Misc
  star: '★',
  check: '✓',
  cross: '✗',
  ellipsis: '…',
};

// Get themed symbols with colors
export function getThemedSymbols() {
  const theme = getCurrentTheme();
  return {
    success: chalk.hex(theme.success)(symbols.success),
    error: chalk.hex(theme.error)(symbols.error),
    warning: chalk.hex(theme.warning)(symbols.warning),
    info: chalk.hex(theme.primary)(symbols.info),
    arrow: chalk.hex(theme.primary)(symbols.arrow),
    pointer: chalk.hex(theme.primary)(symbols.pointer),
    bullet: chalk.hex(theme.dim)(symbols.bullet),
    line: chalk.hex(theme.dim)(symbols.line),
    dash: chalk.hex(theme.dim)(symbols.dash),
    dot: chalk.hex(theme.dim)(symbols.dot),
    file: chalk.hex(theme.dim)(symbols.file),
    fileActive: chalk.hex(theme.primary)(symbols.fileActive),
    folder: chalk.hex(theme.accent)(symbols.folder),
  };
}

/**
 * Minimal ASCII Logo with gradient
 */
export function printLogo(): void {
  const { brand, subtle } = getThemeGradients();
  const theme = getCurrentTheme();
  
  // Clean, minimal logo
  const logo = `
    ┌─────────────────────────────────────────┐
    │                                         │
    │   ○ ○ ○   O P E N E D G E   D S L       │
    │                                         │
    │   CGRA Compiler Toolchain               │
    │                                         │
    └─────────────────────────────────────────┘`;

  console.log(brand.multiline(logo));
  console.log();
}

/**
 * Compact header for screens
 */
export function printCompactHeader(): void {
  const { brand } = getThemeGradients();
  const theme = getCurrentTheme();
  
  console.log();
  console.log('  ' + brand('OpenEdge') + chalk.hex(theme.dim)(' · DSL Compiler v0.1.0'));
  console.log('  ' + chalk.hex(theme.dim)('─'.repeat(40)));
  console.log();
}

/**
 * Print a smaller inline logo
 */
export function printInlineLogo(): void {
  const { brand } = getThemeGradients();
  const theme = getCurrentTheme();
  console.log();
  console.log('  ' + brand('openedge') + chalk.hex(theme.dim)(' v0.1.0'));
  console.log();
}

/**
 * Create a spinner with custom styling
 */
export function createSpinner(text: string): Ora {
  const theme = getCurrentTheme();
  return ora({
    text: chalk.hex(theme.dim)(text),
    spinner: {
      interval: 80,
      frames: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
    },
    color: 'cyan',
  });
}

/**
 * Print a minimal boxed message
 */
export function printBox(content: string, title?: string): void {
  const theme = getCurrentTheme();
  console.log(boxen(content, {
    padding: { top: 0, bottom: 0, left: 1, right: 1 },
    margin: { top: 0, bottom: 1, left: 2, right: 0 },
    borderStyle: 'round',
    borderColor: theme.dim as any,
    dimBorder: true,
    title: title,
    titleAlignment: 'left',
  }));
}

/**
 * Print success message - minimal style
 */
export function printSuccess(message: string, details?: string): void {
  const theme = getCurrentTheme();
  const sym = getThemedSymbols();
  console.log();
  console.log('  ' + sym.success + ' ' + chalk.hex(theme.success)(message));
  if (details) {
    console.log('    ' + chalk.hex(theme.dim)(details));
  }
}

/**
 * Print error message - minimal style
 */
export function printError(message: string, details?: string): void {
  const theme = getCurrentTheme();
  const sym = getThemedSymbols();
  console.log();
  console.log('  ' + sym.error + ' ' + chalk.hex(theme.error)(message));
  if (details) {
    console.log('    ' + chalk.hex(theme.dim)(details));
  }
}

/**
 * Print warning message
 */
export function printWarning(message: string, details?: string): void {
  const theme = getCurrentTheme();
  console.log();
  console.log('  ' + chalk.hex(theme.warning)(symbols.warning) + ' ' + chalk.hex(theme.warning)(message));
  if (details) {
    console.log('    ' + chalk.hex(theme.dim)(details));
  }
}

/**
 * Print info message
 */
export function printInfo(message: string): void {
  const theme = getCurrentTheme();
  console.log('  ' + chalk.hex(theme.dim)(symbols.info) + ' ' + chalk.white(message));
}

/**
 * Print a section header - clean style
 */
export function printHeader(text: string): void {
  const theme = getCurrentTheme();
  console.log();
  console.log('  ' + chalk.bold.white(text));
  console.log('  ' + chalk.hex(theme.dim)('─'.repeat(Math.max(text.length, 20))));
}

/**
 * Print a key-value pair - aligned
 */
export function printKeyValue(key: string, value: string | number, indent: number = 4): void {
  const theme = getCurrentTheme();
  const spaces = ' '.repeat(indent);
  console.log(spaces + chalk.hex(theme.dim)(key.padEnd(16)) + chalk.white(String(value)));
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
  
  console.log('    ' + chalk.hex(theme.dim)(label.padEnd(16)) + chalk.hex(colorMap[color])(String(value)));
}

/**
 * Print compilation stats - clean table format
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
    printStat('output', stats.output, 'primary');
  }
  if (stats.cycles !== undefined) {
    printStat('cycles', stats.cycles, 'success');
  }
  if (stats.grid) {
    printStat('grid', `${stats.grid.width}×${stats.grid.height}`, 'white');
  }
  if (stats.memoryRegions !== undefined) {
    printStat('memory', `${stats.memoryRegions} region${stats.memoryRegions !== 1 ? 's' : ''}`, 'white');
  }
  if (stats.assertions !== undefined && stats.assertions > 0) {
    printStat('assertions', stats.assertions, 'warning');
  }
  
  if (stats.time !== undefined) {
    console.log();
    console.log('  ' + chalk.hex(theme.dim)(`Done in ${stats.time.toFixed(0)}ms`));
  }
}

/**
 * Print a code frame with syntax highlighting - minimal style
 */
export function printCodeFrame(
  source: string,
  line: number,
  column: number,
  message: string,
  filePath?: string
): void {
  const theme = getCurrentTheme();
  const lines = source.split('\n');
  const startLine = Math.max(0, line - 3);
  const endLine = Math.min(lines.length, line + 2);
  
  console.log();
  
  // File location - clean format
  if (filePath) {
    console.log('  ' + chalk.hex(theme.dim)('at ') + chalk.hex(theme.primary).underline(`${filePath}:${line}:${column}`));
    console.log();
  }

  // Code context with line numbers
  for (let i = startLine; i < endLine; i++) {
    const lineNum = i + 1;
    const isErrorLine = lineNum === line;
    const lineNumStr = String(lineNum).padStart(4);
    const gutter = chalk.hex(theme.dim)(' │ ');
    
    if (isErrorLine) {
      // Error line with marker
      console.log(
        '  ' + chalk.hex(theme.error)(lineNumStr) + 
        chalk.hex(theme.error)(' │ ') + 
        lines[i]
      );
      
      // Underline the error position
      const spaces = ' '.repeat(column - 1);
      console.log(
        '  ' + ' '.repeat(4) + 
        chalk.hex(theme.error)(' │ ') + 
        spaces + chalk.hex(theme.error)('^'.repeat(Math.min(3, lines[i].length - column + 1)))
      );
    } else {
      // Context line
      console.log(
        '  ' + chalk.hex(theme.dim)(lineNumStr) + 
        gutter + 
        chalk.hex(theme.dim)(lines[i])
      );
    }
  }
  
  console.log();
  console.log('  ' + chalk.hex(theme.error)('error: ') + chalk.white(message));
  console.log();
}

/**
 * Print welcome message for interactive mode - minimal
 */
export function printWelcome(): void {
  const theme = getCurrentTheme();
  console.clear();
  printLogo();
  
  // Minimal help text
  console.log('  ' + chalk.hex(theme.dim)('Navigate with ↑↓  Select with Enter  Exit with Ctrl+C'));
  console.log();
}

/**
 * Print a divider line
 */
export function printDivider(): void {
  const theme = getCurrentTheme();
  console.log('  ' + chalk.hex(theme.dim)('─'.repeat(45)));
}

/**
 * Print file info - minimal badge style
 */
export function printFileBadge(filePath: string): void {
  const theme = getCurrentTheme();
  console.log();
  console.log('  ' + chalk.hex(theme.dim)('file ') + chalk.hex(theme.primary)(filePath));
}

/**
 * Print status badge - text only, no background
 */
export function printStatusBadge(status: 'valid' | 'invalid' | 'compiling' | 'watching'): void {
  const theme = getCurrentTheme();
  const badges = {
    valid: chalk.hex(theme.success)('● valid'),
    invalid: chalk.hex(theme.error)('● invalid'),
    compiling: chalk.hex(theme.warning)('● compiling'),
    watching: chalk.hex(theme.primary)('● watching'),
  };
  console.log('  ' + badges[status]);
}

/**
 * Print theme preview - minimal color swatches
 */
export function printThemePreview(themeName: string, theme: Theme): void {
  console.log();
  console.log('  ' + chalk.bold(theme.name));
  console.log('  ' + 
    chalk.hex(theme.primary)('●') + ' ' +
    chalk.hex(theme.secondary)('●') + ' ' +
    chalk.hex(theme.accent)('●') + ' ' +
    chalk.hex(theme.success)('●') + ' ' +
    chalk.hex(theme.error)('●')
  );
}

/**
 * Print a list item - clean format
 */
export function printListItem(text: string, active: boolean = false, indent: number = 2): void {
  const theme = getCurrentTheme();
  const spaces = ' '.repeat(indent);
  const marker = active ? chalk.hex(theme.primary)(symbols.pointer) : chalk.hex(theme.dim)(symbols.dot);
  console.log(spaces + marker + ' ' + text);
}

/**
 * Print recent files list - minimal format
 */
export function printRecentFiles(files: { path: string; accessCount: number }[]): void {
  const theme = getCurrentTheme();
  
  if (files.length === 0) {
    console.log('  ' + chalk.hex(theme.dim)('No recent files'));
    return;
  }
  
  files.forEach((file, index) => {
    const num = chalk.hex(theme.dim)(`${index + 1}.`);
    const path = chalk.white(file.path);
    const count = chalk.hex(theme.dim)(`×${file.accessCount}`);
    console.log(`  ${num} ${path} ${count}`);
  });
}

/**
 * Print a progress indicator
 */
export function printProgress(current: number, total: number, label?: string): void {
  const theme = getCurrentTheme();
  const width = 20;
  const filled = Math.round((current / total) * width);
  const empty = width - filled;
  
  const bar = chalk.hex(theme.primary)('█'.repeat(filled)) + 
              chalk.hex(theme.dim)('░'.repeat(empty));
  
  const percent = Math.round((current / total) * 100);
  const text = label ? `${label} ` : '';
  
  process.stdout.write(`\r  ${text}${bar} ${percent}%`);
  
  if (current === total) {
    console.log();
  }
}

/**
 * Clear screen and reset cursor
 */
export function clearScreen(): void {
  console.clear();
}

/**
 * Print a subtle hint
 */
export function printHint(text: string): void {
  const theme = getCurrentTheme();
  console.log('  ' + chalk.hex(theme.dim).italic(text));
}

/**
 * Print action result in compact form
 */
export function printResult(success: boolean, message: string, time?: number): void {
  const theme = getCurrentTheme();
  const sym = success ? 
    chalk.hex(theme.success)(symbols.success) : 
    chalk.hex(theme.error)(symbols.error);
  
  let line = '  ' + sym + ' ' + message;
  
  if (time !== undefined) {
    line += chalk.hex(theme.dim)(` (${time.toFixed(0)}ms)`);
  }
  
  console.log(line);
}

export { chalk, gradient, ora };
