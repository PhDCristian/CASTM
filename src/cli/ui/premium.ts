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
  arrowUp: '▴',
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
  
  // Keys
  enter: '↵',
  escape: '⎋',
  tab: '⇥',
  
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
 * Premium ASCII Logo with gradient - sleek design
 */
export function printLogo(): void {
  const { brand } = getThemeGradients();
  const theme = getCurrentTheme();
  
  // Sleek, modern logo
  const logo = `
   ┌────────────────────────────────────────────────┐
   │                                                │
   │    ╱╲    OpenEdge DSL                          │
   │   ╱  ╲   ─────────────────                     │
   │  ╱    ╲  CGRA Compiler Toolchain    v0.1.0    │
   │ ╱──────╲                                       │
   │                                                │
   └────────────────────────────────────────────────┘`;

  console.log(brand.multiline(logo));
  console.log();
}

/**
 * Print compact header with version
 */
export function printCompactHeader(): void {
  const { brand } = getThemeGradients();
  const theme = getCurrentTheme();
  
  console.log();
  console.log('  ' + brand('openedge') + chalk.hex(theme.dim)(' · v0.1.0'));
  console.log('  ' + chalk.hex(theme.dim)('─'.repeat(40)));
  console.log();
}

/**
 * Print keyboard shortcuts hint bar
 */
export function printKeyboardHints(hints: { key: string; action: string }[]): void {
  const theme = getCurrentTheme();
  
  const formatted = hints.map(h => 
    chalk.hex(theme.primary)(h.key) + chalk.hex(theme.dim)(` ${h.action}`)
  ).join(chalk.hex(theme.dim)('  │  '));
  
  console.log('  ' + formatted);
  console.log();
}

/**
 * Print status bar at bottom
 */
export function printStatusBar(left: string, right?: string): void {
  const theme = getCurrentTheme();
  const width = 50;
  
  const leftText = chalk.hex(theme.dim)(left);
  const rightText = right ? chalk.hex(theme.dim)(right) : '';
  
  console.log();
  console.log('  ' + chalk.hex(theme.dim)('─'.repeat(width)));
  
  if (right) {
    const padding = width - left.length - right.length;
    console.log('  ' + leftText + ' '.repeat(Math.max(padding, 2)) + rightText);
  } else {
    console.log('  ' + leftText);
  }
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
      console.log(
        '  ' + chalk.hex(theme.error)(lineNumStr) + 
        chalk.hex(theme.error)(' │ ') + 
        highlightDslSyntax(lines[i], theme)
      );
      
      const spaces = ' '.repeat(column - 1);
      console.log(
        '  ' + ' '.repeat(4) + 
        chalk.hex(theme.error)(' │ ') + 
        spaces + chalk.hex(theme.error)('^'.repeat(Math.min(3, lines[i].length - column + 1)))
      );
    } else {
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
 * Highlight DSL syntax - basic highlighting
 */
export function highlightDslSyntax(code: string, theme: Theme): string {
  // Keywords
  code = code.replace(/\b(kernel|config|cycle|function|for|while|if|else|row)\b/g, 
    chalk.hex(theme.primary)('$1'));
  
  // Directives
  code = code.replace(/(\.\w+)/g, chalk.hex(theme.accent)('$1'));
  
  // Registers
  code = code.replace(/\b(R\d+|ROUT|RCL|RCR|RCU|RCD|ZERO)\b/g, 
    chalk.hex(theme.warning)('$1'));
  
  // Operations
  code = code.replace(/\b(LWI|SWI|SADD|SSUB|SMUL|SDIV|NOP|EXIT|ASSERT)\b/g, 
    chalk.hex(theme.success)('$1'));
  
  // Numbers
  code = code.replace(/\b(0x[0-9a-fA-F]+|\d+)\b/g, 
    chalk.hex(theme.secondary)('$1'));
  
  // Comments
  code = code.replace(/(\/\/.*)$/g, chalk.hex(theme.dim)('$1'));
  
  // Strings
  code = code.replace(/(".*?")/g, chalk.hex(theme.secondary)('$1'));
  
  return code;
}

/**
 * Print welcome message for interactive mode - minimal
 */
export function printWelcome(): void {
  console.clear();
  printLogo();
  
  printKeyboardHints([
    { key: '↑↓', action: 'navigate' },
    { key: '↵', action: 'select' },
    { key: 'ctrl+c', action: 'exit' },
  ]);
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

/**
 * Print help panel for interactive mode
 */
export function printHelpPanel(): void {
  const theme = getCurrentTheme();
  const { brand } = getThemeGradients();
  
  console.clear();
  console.log();
  console.log('  ' + brand('OpenEdge DSL') + chalk.hex(theme.dim)(' · Help'));
  console.log('  ' + chalk.hex(theme.dim)('─'.repeat(50)));
  console.log();
  
  console.log('  ' + chalk.white('Commands'));
  console.log('  ' + chalk.hex(theme.dim)('─'.repeat(20)));
  console.log();
  printKeyValue('compile', 'Compile DSL source to CSV format');
  printKeyValue('check', 'Validate syntax without output');
  printKeyValue('info', 'Show program statistics');
  printKeyValue('watch', 'Auto-recompile on file changes');
  console.log();
  
  console.log('  ' + chalk.white('Keyboard'));
  console.log('  ' + chalk.hex(theme.dim)('─'.repeat(20)));
  console.log();
  printKeyValue('↑ ↓', 'Navigate menu items');
  printKeyValue('Enter', 'Select current item');
  printKeyValue('Ctrl+C', 'Exit / Cancel');
  console.log();
  
  console.log('  ' + chalk.white('CLI Usage'));
  console.log('  ' + chalk.hex(theme.dim)('─'.repeat(20)));
  console.log();
  console.log('    ' + chalk.hex(theme.primary)('openedge') + chalk.hex(theme.dim)(' compile file.dsl -o out.csv'));
  console.log('    ' + chalk.hex(theme.primary)('openedge') + chalk.hex(theme.dim)(' check file.dsl'));
  console.log('    ' + chalk.hex(theme.primary)('openedge') + chalk.hex(theme.dim)(' watch file.dsl'));
  console.log('    ' + chalk.hex(theme.primary)('openedge') + chalk.hex(theme.dim)(' theme dracula'));
  console.log();
  
  console.log('  ' + chalk.white('Themes'));
  console.log('  ' + chalk.hex(theme.dim)('─'.repeat(20)));
  console.log();
  console.log('    default, ocean, sunset, nord, dracula, monokai, cyberpunk, minimal');
  console.log();
}

/**
 * Print DSL file with syntax highlighting
 */
export function printDslPreview(content: string, maxLines: number = 15): void {
  const theme = getCurrentTheme();
  const lines = content.split('\n').slice(0, maxLines);
  
  console.log();
  lines.forEach((line, i) => {
    const lineNum = String(i + 1).padStart(3);
    console.log(
      '  ' + chalk.hex(theme.dim)(lineNum) + 
      chalk.hex(theme.dim)(' │ ') + 
      highlightDslSyntax(line, theme)
    );
  });
  
  if (content.split('\n').length > maxLines) {
    console.log('  ' + chalk.hex(theme.dim)(`    │ ... (${content.split('\n').length - maxLines} more lines)`));
  }
  console.log();
}

export { chalk, gradient, ora };
