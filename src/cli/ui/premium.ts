/**
 * Premium UI components for CLI
 * Professional design with block logo, panels, gradients, and animations
 */

import chalk from 'chalk';
import gradient from 'gradient-string';
import boxen from 'boxen';
import ora, { Ora } from 'ora';
import { getCurrentTheme, Theme, BUILTIN_THEMES } from '../config/store.js';

// ═══════════════════════════════════════════════════════════════════════════
// THEME AND GRADIENTS
// ═══════════════════════════════════════════════════════════════════════════

function getThemeGradients() {
  const theme = getCurrentTheme();
  return {
    brand: gradient([theme.primary, theme.secondary]),
    brandAlt: gradient([theme.secondary, theme.primary]),
    success: gradient([theme.success, theme.primary]),
    error: gradient([theme.error, theme.warning]),
    accent: gradient([theme.accent, theme.primary]),
    subtle: gradient(['#888888', '#555555']),
    theme,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// SYMBOLS
// ═══════════════════════════════════════════════════════════════════════════

export const symbols = {
  // Status
  success: '✓',
  error: '✗',
  warning: '⚠',
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
  
  // Progress
  blockFull: '█',
  blockMed: '▓',
  blockLight: '░',
  
  // Decorative
  star: '★',
  diamond: '◆',
  circle: '●',
  circleEmpty: '○',
};

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
    file: chalk.hex(theme.dim)(symbols.file),
    fileActive: chalk.hex(theme.primary)(symbols.fileActive),
    folder: chalk.hex(theme.accent)(symbols.folder),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// BLOCK LOGO
// ═══════════════════════════════════════════════════════════════════════════

const LOGO_LINES = [
  ' ██████╗ ██████╗ ███████╗███╗   ██╗███████╗██████╗  ██████╗ ███████╗',
  '██╔═══██╗██╔══██╗██╔════╝████╗  ██║██╔════╝██╔══██╗██╔════╝ ██╔════╝',
  '██║   ██║██████╔╝█████╗  ██╔██╗ ██║█████╗  ██║  ██║██║  ███╗█████╗  ',
  '██║   ██║██╔═══╝ ██╔══╝  ██║╚██╗██║██╔══╝  ██║  ██║██║   ██║██╔══╝  ',
  '╚██████╔╝██║     ███████╗██║ ╚████║███████╗██████╔╝╚██████╔╝███████╗',
  ' ╚═════╝ ╚═╝     ╚══════╝╚═╝  ╚═══╝╚══════╝╚═════╝  ╚═════╝ ╚══════╝',
];

const LOGO_COMPACT = [
  '╔═══════════════════════════════════════╗',
  '║   OPENEDGE   ·   CGRA DSL Compiler    ║',
  '╚═══════════════════════════════════════╝',
];

/**
 * Print the main block logo with gradient
 */
export function printLogo(): void {
  const { brand } = getThemeGradients();
  const theme = getCurrentTheme();
  
  console.log();
  LOGO_LINES.forEach(line => {
    console.log('  ' + brand(line));
  });
  console.log();
  console.log('  ' + chalk.hex(theme.dim)('CGRA Compiler Toolchain') + 
              chalk.hex(theme.dim)(' · ') + 
              chalk.hex(theme.primary)('v0.1.0'));
  console.log();
}

/**
 * Print compact header for subcommands
 */
export function printCompactHeader(): void {
  const { brand } = getThemeGradients();
  const theme = getCurrentTheme();
  
  console.log();
  console.log('  ' + brand('OPENEDGE') + chalk.hex(theme.dim)(' · v0.1.0'));
  console.log();
}

/**
 * Print banner-style header in a box
 */
export function printBannerHeader(subtitle?: string): void {
  const { brand } = getThemeGradients();
  const theme = getCurrentTheme();
  
  const content = brand('OPENEDGE') + '\n' + 
                  chalk.hex(theme.dim)(subtitle || 'CGRA DSL Compiler');
  
  console.log();
  console.log(boxen(content, {
    padding: { top: 0, bottom: 0, left: 2, right: 2 },
    margin: { top: 0, bottom: 0, left: 1, right: 0 },
    borderStyle: 'round',
    borderColor: theme.primary,
  }));
}

// ═══════════════════════════════════════════════════════════════════════════
// PANELS AND BOXES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a styled panel with content
 */
export function createPanel(
  content: string, 
  options: {
    title?: string;
    borderColor?: string;
    padding?: number;
    style?: 'round' | 'double' | 'single' | 'bold';
  } = {}
): string {
  const theme = getCurrentTheme();
  
  return boxen(content, {
    padding: { top: 0, bottom: 0, left: options.padding ?? 1, right: options.padding ?? 1 },
    margin: { top: 0, bottom: 0, left: 1, right: 0 },
    borderStyle: options.style || 'round',
    borderColor: options.borderColor || theme.primary,
    title: options.title,
    titleAlignment: 'left',
  });
}

/**
 * Print an info panel
 */
export function printInfoPanel(title: string, items: { label: string; value: string }[]): void {
  const theme = getCurrentTheme();
  
  const content = items.map(item => 
    chalk.hex(theme.dim)(item.label.padEnd(14)) + chalk.white(item.value)
  ).join('\n');
  
  console.log(createPanel(content, { title: chalk.hex(theme.primary)(title), style: 'round' }));
}

/**
 * Print a success panel
 */
export function printSuccessPanel(title: string, message: string, details?: string[]): void {
  const theme = getCurrentTheme();
  const sym = getThemedSymbols();
  
  let content = sym.success + ' ' + chalk.hex(theme.success)(message);
  
  if (details && details.length > 0) {
    content += '\n\n' + details.map(d => chalk.hex(theme.dim)('  ' + d)).join('\n');
  }
  
  console.log(createPanel(content, { 
    title: chalk.hex(theme.success)(title), 
    borderColor: theme.success,
    style: 'round' 
  }));
}

/**
 * Print an error panel
 */
export function printErrorPanel(title: string, message: string, details?: string[]): void {
  const theme = getCurrentTheme();
  const sym = getThemedSymbols();
  
  let content = sym.error + ' ' + chalk.hex(theme.error)(message);
  
  if (details && details.length > 0) {
    content += '\n\n' + details.map(d => chalk.hex(theme.dim)('  ' + d)).join('\n');
  }
  
  console.log(createPanel(content, { 
    title: chalk.hex(theme.error)(title), 
    borderColor: theme.error,
    style: 'round' 
  }));
}

// ═══════════════════════════════════════════════════════════════════════════
// STATUS INDICATORS AND BADGES
// ═══════════════════════════════════════════════════════════════════════════

export type StatusType = 'success' | 'error' | 'warning' | 'info' | 'pending' | 'running';

/**
 * Get a colored status badge
 */
export function getStatusBadge(status: StatusType): string {
  const theme = getCurrentTheme();
  
  const badges: Record<StatusType, string> = {
    success: chalk.bgHex(theme.success).black(' SUCCESS '),
    error: chalk.bgHex(theme.error).white(' ERROR '),
    warning: chalk.bgHex(theme.warning).black(' WARNING '),
    info: chalk.bgHex(theme.primary).black(' INFO '),
    pending: chalk.bgHex(theme.dim).white(' PENDING '),
    running: chalk.bgHex(theme.accent).white(' RUNNING '),
  };
  
  return badges[status];
}

/**
 * Print a status line with badge
 */
export function printStatusLine(status: StatusType, message: string): void {
  console.log('  ' + getStatusBadge(status) + ' ' + message);
}

/**
 * Print file status indicator
 */
export function printFileStatus(filePath: string, status: 'valid' | 'invalid' | 'modified' | 'new'): void {
  const theme = getCurrentTheme();
  const statusColors: Record<string, string> = {
    valid: theme.success,
    invalid: theme.error,
    modified: theme.warning,
    new: theme.primary,
  };
  
  const indicator = chalk.hex(statusColors[status])('●');
  console.log('  ' + indicator + ' ' + chalk.white(filePath) + chalk.hex(theme.dim)(` [${status}]`));
}

// ═══════════════════════════════════════════════════════════════════════════
// PROGRESS INDICATORS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a styled spinner
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
    prefixText: '  ',
  });
}

/**
 * Print a progress bar
 */
export function printProgressBar(current: number, total: number, options: {
  label?: string;
  width?: number;
  showPercent?: boolean;
} = {}): void {
  const theme = getCurrentTheme();
  const { label, width = 30, showPercent = true } = options;
  
  const percent = Math.round((current / total) * 100);
  const filled = Math.round((current / total) * width);
  const empty = width - filled;
  
  const bar = chalk.hex(theme.primary)(symbols.blockFull.repeat(filled)) + 
              chalk.hex(theme.dim)(symbols.blockLight.repeat(empty));
  
  let line = '  ';
  if (label) line += chalk.hex(theme.dim)(label + ' ');
  line += bar;
  if (showPercent) line += chalk.hex(theme.dim)(` ${percent}%`);
  
  process.stdout.write('\r' + line);
  if (current === total) console.log();
}

/**
 * Print compilation progress with stages
 */
export function printCompilationProgress(stage: string, done: boolean = false): void {
  const theme = getCurrentTheme();
  const sym = done ? getThemedSymbols().success : chalk.hex(theme.warning)('○');
  console.log('  ' + sym + ' ' + chalk.white(stage));
}

// ═══════════════════════════════════════════════════════════════════════════
// MESSAGES
// ═══════════════════════════════════════════════════════════════════════════

export function printSuccess(message: string, details?: string): void {
  const theme = getCurrentTheme();
  const sym = getThemedSymbols();
  console.log();
  console.log('  ' + sym.success + ' ' + chalk.hex(theme.success)(message));
  if (details) {
    console.log('    ' + chalk.hex(theme.dim)(details));
  }
}

export function printError(message: string, details?: string): void {
  const theme = getCurrentTheme();
  const sym = getThemedSymbols();
  console.log();
  console.log('  ' + sym.error + ' ' + chalk.hex(theme.error)(message));
  if (details) {
    console.log('    ' + chalk.hex(theme.dim)(details));
  }
}

export function printWarning(message: string, details?: string): void {
  const theme = getCurrentTheme();
  console.log();
  console.log('  ' + chalk.hex(theme.warning)(symbols.warning) + ' ' + chalk.hex(theme.warning)(message));
  if (details) {
    console.log('    ' + chalk.hex(theme.dim)(details));
  }
}

export function printInfo(message: string): void {
  const theme = getCurrentTheme();
  console.log('  ' + chalk.hex(theme.primary)(symbols.info) + ' ' + chalk.white(message));
}

// ═══════════════════════════════════════════════════════════════════════════
// HEADERS AND DIVIDERS
// ═══════════════════════════════════════════════════════════════════════════

export function printHeader(text: string): void {
  const theme = getCurrentTheme();
  console.log();
  console.log('  ' + chalk.bold.white(text));
  console.log('  ' + chalk.hex(theme.dim)('─'.repeat(Math.max(text.length, 30))));
}

export function printDivider(width: number = 50): void {
  const theme = getCurrentTheme();
  console.log('  ' + chalk.hex(theme.dim)('─'.repeat(width)));
}

export function printSectionHeader(text: string): void {
  const { brand } = getThemeGradients();
  console.log();
  console.log('  ' + brand('▌') + ' ' + chalk.bold.white(text));
  console.log();
}

// ═══════════════════════════════════════════════════════════════════════════
// KEY-VALUE DISPLAY
// ═══════════════════════════════════════════════════════════════════════════

export function printKeyValue(key: string, value: string | number, indent: number = 4): void {
  const theme = getCurrentTheme();
  const spaces = ' '.repeat(indent);
  console.log(spaces + chalk.hex(theme.dim)(key.padEnd(16)) + chalk.white(String(value)));
}

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

export function printCompilationStats(stats: {
  output?: string;
  cycles?: number;
  grid?: { width: number; height: number };
  memoryRegions?: number;
  assertions?: number;
  time?: number;
}): void {
  const theme = getCurrentTheme();
  
  const items: { label: string; value: string }[] = [];
  
  if (stats.output) items.push({ label: 'Output', value: stats.output });
  if (stats.cycles !== undefined) items.push({ label: 'Cycles', value: String(stats.cycles) });
  if (stats.grid) items.push({ label: 'Grid', value: `${stats.grid.width}×${stats.grid.height}` });
  if (stats.memoryRegions !== undefined) items.push({ label: 'Memory', value: `${stats.memoryRegions} region${stats.memoryRegions !== 1 ? 's' : ''}` });
  if (stats.assertions !== undefined && stats.assertions > 0) items.push({ label: 'Assertions', value: String(stats.assertions) });
  if (stats.time !== undefined) items.push({ label: 'Time', value: `${stats.time.toFixed(0)}ms` });
  
  if (items.length > 0) {
    console.log();
    printInfoPanel('Compilation Results', items);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CODE DISPLAY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Tokenize a DSL line for syntax highlighting
 */
interface Token {
  text: string;
  type: 'keyword' | 'directive' | 'operation' | 'register' | 'string' | 'number' | 'comment' | 'address' | 'punctuation' | 'default';
}

function tokenizeDslLine(line: string): Token[] {
  const tokens: Token[] = [];
  
  // Check for full-line comment
  const fullCommentMatch = line.match(/^(\s*)(\/\/.*)$/);
  if (fullCommentMatch) {
    if (fullCommentMatch[1]) tokens.push({ text: fullCommentMatch[1], type: 'default' });
    tokens.push({ text: fullCommentMatch[2], type: 'comment' });
    return tokens;
  }
  
  // Pattern definitions
  const patterns: [RegExp, Token['type']][] = [
    [/\/\/.*$/, 'comment'],
    [/"[^"]*"/, 'string'],
    [/@\d+,\d+:/, 'address'],
    [/\.(data|kernel|config|assert)\b/, 'directive'],
    [/\b(kernel|config|cycle|function|for|while|if|else|row)\b/, 'keyword'],
    [/\b(LWI|SWI|SADD|SSUB|SMUL|SDIV|NOP|EXIT|ASSERT|MUL|ADD|SUB|DIV|AND|OR|XOR|SHL|SHR)\b/, 'operation'],
    [/\b(ROUT|RCL|RCR|RCU|RCD|ZERO|R[0-7])\b/, 'register'],
    [/\b(0x[0-9A-Fa-f]+|\d+)\b/, 'number'],
    [/[{}()\[\];,]/, 'punctuation'],
  ];
  
  let remaining = line;
  let pos = 0;
  
  while (remaining.length > 0) {
    let matched = false;
    
    // Try each pattern
    for (const [pattern, type] of patterns) {
      const match = remaining.match(pattern);
      if (match && match.index === 0) {
        tokens.push({ text: match[0], type });
        remaining = remaining.slice(match[0].length);
        matched = true;
        break;
      }
    }
    
    if (!matched) {
      // Find next token start
      let nextMatch = remaining.length;
      for (const [pattern] of patterns) {
        const match = remaining.match(pattern);
        if (match && match.index !== undefined && match.index > 0 && match.index < nextMatch) {
          nextMatch = match.index;
        }
      }
      
      if (nextMatch > 0) {
        tokens.push({ text: remaining.slice(0, nextMatch), type: 'default' });
        remaining = remaining.slice(nextMatch);
      } else {
        tokens.push({ text: remaining, type: 'default' });
        break;
      }
    }
  }
  
  return tokens;
}

function colorizeToken(token: Token, theme: Theme): string {
  const colors: Record<Token['type'], string> = {
    keyword: theme.primary,
    directive: theme.accent,
    operation: theme.success,
    register: theme.warning,
    string: theme.secondary,
    number: theme.secondary,
    comment: theme.dim,
    address: theme.accent,
    punctuation: theme.dim,
    default: '#ffffff',
  };
  
  return chalk.hex(colors[token.type])(token.text);
}

/**
 * Print DSL file preview with syntax highlighting
 */
export function printDslPreview(content: string, options: {
  maxLines?: number;
  showLineNumbers?: boolean;
  highlight?: number; // Line to highlight
  title?: string;
} = {}): void {
  const theme = getCurrentTheme();
  const { maxLines = 25, showLineNumbers = true, highlight, title } = options;
  
  const allLines = content.split('\n');
  const lines = allLines.slice(0, maxLines);
  const lineNumWidth = String(Math.min(allLines.length, maxLines)).length + 1;
  
  console.log();
  
  if (title) {
    console.log('  ' + chalk.hex(theme.primary)(symbols.file) + ' ' + chalk.white(title));
    console.log('  ' + chalk.hex(theme.dim)('─'.repeat(50)));
  }
  
  lines.forEach((line, i) => {
    const lineNum = i + 1;
    const isHighlighted = lineNum === highlight;
    
    // Tokenize and colorize
    const tokens = tokenizeDslLine(line);
    const coloredLine = tokens.map(t => colorizeToken(t, theme)).join('');
    
    if (showLineNumbers) {
      const numStr = String(lineNum).padStart(lineNumWidth);
      const gutter = isHighlighted ? 
        chalk.hex(theme.warning)(numStr + ' ▸ ') : 
        chalk.hex(theme.dim)(numStr + ' │ ');
      
      if (isHighlighted) {
        console.log('  ' + gutter + chalk.bgHex('#333333')(coloredLine));
      } else {
        console.log('  ' + gutter + coloredLine);
      }
    } else {
      console.log('  ' + coloredLine);
    }
  });
  
  if (allLines.length > maxLines) {
    const remaining = allLines.length - maxLines;
    console.log('  ' + ' '.repeat(lineNumWidth) + chalk.hex(theme.dim)(` │ ... ${remaining} more lines`));
  }
  
  console.log();
}

// ═══════════════════════════════════════════════════════════════════════════
// ERROR CARDS
// ═══════════════════════════════════════════════════════════════════════════

export interface ErrorCardOptions {
  message: string;
  file?: string;
  line?: number;
  column?: number;
  source?: string;
  suggestion?: string;
}

/**
 * Get suggestion based on error message
 */
function getErrorSuggestion(error: string): string | undefined {
  const patterns: [RegExp, string][] = [
    [/unexpected token/i, 'Check for missing semicolons, commas, or brackets'],
    [/unknown register/i, 'Valid registers: R0-R7, ROUT, RCL, RCR, RCU, RCD, ZERO'],
    [/unknown operation/i, 'Valid operations: LWI, SWI, SADD, SSUB, SMUL, NOP, EXIT'],
    [/expected.*,/i, 'Add a comma between operands'],
    [/expected.*;/i, 'Add a semicolon at the end of the statement'],
    [/expected.*\}/i, 'Add a closing brace }'],
    [/expected.*\{/i, 'Add an opening brace {'],
    [/undefined.*variable/i, 'Declare the variable with .data or .const before use'],
    [/unexpected end/i, 'Check for unclosed blocks or missing statements'],
  ];
  
  for (const [pattern, suggestion] of patterns) {
    if (pattern.test(error)) {
      return suggestion;
    }
  }
  
  return undefined;
}

/**
 * Print a styled error card with context and suggestions
 */
export function printErrorCard(options: ErrorCardOptions): void {
  const theme = getCurrentTheme();
  
  let content = chalk.hex(theme.error)(symbols.error + ' ') + chalk.white(options.message);
  
  // File location
  if (options.file) {
    const location = options.line 
      ? `${options.file}:${options.line}${options.column ? ':' + options.column : ''}`
      : options.file;
    content += '\n' + chalk.hex(theme.dim)('   at ') + chalk.hex(theme.primary).underline(location);
  }
  
  // Code context
  if (options.source && options.line) {
    const lines = options.source.split('\n');
    const errorLine = options.line - 1;
    const start = Math.max(0, errorLine - 1);
    const end = Math.min(lines.length, errorLine + 2);
    
    content += '\n';
    
    for (let i = start; i < end; i++) {
      const lineNum = i + 1;
      const isError = lineNum === options.line;
      const prefix = isError ? chalk.hex(theme.error)('→ ') : '  ';
      const numStr = String(lineNum).padStart(3);
      
      if (isError) {
        content += '\n' + prefix + chalk.hex(theme.error)(numStr) + chalk.hex(theme.error)(' │ ') + chalk.white(lines[i]);
        if (options.column && options.column > 0) {
          const pointer = ' '.repeat(options.column - 1) + chalk.hex(theme.error)('▲');
          content += '\n' + '  ' + '   ' + chalk.hex(theme.error)(' │ ') + pointer;
        }
      } else {
        content += '\n' + prefix + chalk.hex(theme.dim)(numStr + ' │ ' + lines[i]);
      }
    }
  }
  
  // Auto-suggestion
  const suggestion = options.suggestion || getErrorSuggestion(options.message);
  if (suggestion) {
    content += '\n\n' + chalk.hex(theme.accent)('hint: ') + chalk.white(suggestion);
  }
  
  console.log(boxen(content, {
    title: chalk.hex(theme.error)(' Error '),
    titleAlignment: 'left',
    padding: { left: 1, right: 1, top: 0, bottom: 0 },
    margin: { left: 1, top: 1, bottom: 1, right: 0 },
    borderStyle: 'round',
    borderColor: theme.error,
  }));
}

/**
 * Print code frame for errors
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
  
  if (filePath) {
    console.log('  ' + chalk.hex(theme.dim)('at ') + chalk.hex(theme.primary).underline(`${filePath}:${line}:${column}`));
    console.log();
  }

  for (let i = startLine; i < endLine; i++) {
    const lineNum = i + 1;
    const isErrorLine = lineNum === line;
    const lineNumStr = String(lineNum).padStart(4);
    
    if (isErrorLine) {
      console.log(
        '  ' + chalk.hex(theme.error)(lineNumStr) + 
        chalk.hex(theme.error)(' │ ') + 
        chalk.white(lines[i])
      );
      
      const spaces = ' '.repeat(Math.max(0, column - 1));
      console.log(
        '  ' + ' '.repeat(4) + 
        chalk.hex(theme.error)(' │ ') + 
        spaces + chalk.hex(theme.error)('^'.repeat(Math.min(3, lines[i].length - column + 1)))
      );
    } else {
      console.log(
        '  ' + chalk.hex(theme.dim)(lineNumStr) + 
        chalk.hex(theme.dim)(' │ ') + 
        chalk.hex(theme.dim)(lines[i])
      );
    }
  }
  
  console.log();
  console.log('  ' + chalk.hex(theme.error)('error: ') + chalk.white(message));
  console.log();
}

// ═══════════════════════════════════════════════════════════════════════════
// INTERACTIVE MODE
// ═══════════════════════════════════════════════════════════════════════════

export function printWelcome(): void {
  console.clear();
  printLogo();
  printKeyboardHints([
    { key: '↑↓', action: 'navigate' },
    { key: '⏎', action: 'select' },
    { key: '^C', action: 'exit' },
  ]);
}

export function printKeyboardHints(hints: { key: string; action: string }[]): void {
  const theme = getCurrentTheme();
  
  const formatted = hints.map(h => 
    chalk.bgHex('#333333').white(' ' + h.key + ' ') + ' ' + chalk.hex(theme.dim)(h.action)
  ).join('   ');
  
  console.log('  ' + formatted);
  console.log();
}

export function printHelpPanel(): void {
  const theme = getCurrentTheme();
  const { brand } = getThemeGradients();
  
  console.clear();
  printBannerHeader('Help');
  
  console.log();
  printSectionHeader('Commands');
  
  const commands = [
    { cmd: 'compile <file>', desc: 'Compile DSL to CSV' },
    { cmd: 'check <file>', desc: 'Validate syntax' },
    { cmd: 'info <file>', desc: 'Show program details' },
    { cmd: 'preview <file>', desc: 'View source code' },
    { cmd: 'watch <file>', desc: 'Auto-recompile on changes' },
    { cmd: 'theme [name]', desc: 'Change color theme' },
  ];
  
  commands.forEach(c => {
    console.log('    ' + chalk.hex(theme.primary)(c.cmd.padEnd(18)) + chalk.hex(theme.dim)(c.desc));
  });
  
  console.log();
  printSectionHeader('Keyboard');
  
  const keys = [
    { key: '↑ ↓', desc: 'Navigate' },
    { key: 'Enter', desc: 'Select' },
    { key: 'Ctrl+C', desc: 'Exit' },
  ];
  
  keys.forEach(k => {
    console.log('    ' + chalk.white(k.key.padEnd(12)) + chalk.hex(theme.dim)(k.desc));
  });
  
  console.log();
  printSectionHeader('Examples');
  
  console.log('    ' + chalk.hex(theme.primary)('$') + ' openedge compile program.dsl -o output.csv');
  console.log('    ' + chalk.hex(theme.primary)('$') + ' openedge watch program.dsl');
  console.log('    ' + chalk.hex(theme.primary)('$') + ' openedge theme dracula');
  console.log();
}

// ═══════════════════════════════════════════════════════════════════════════
// THEME DISPLAY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate sample DSL code colored with a specific theme
 */
export function generateThemePreviewCode(themeName: string): string {
  const t = BUILTIN_THEMES[themeName] || getCurrentTheme();
  
  const lines = [
    chalk.hex(t.dim)('// Sample code'),
    chalk.hex(t.accent)('.data') + ' input { ' + chalk.hex(t.secondary)('10, 20') + ' }',
    '',
    chalk.hex(t.primary)('kernel') + ' ' + chalk.hex(t.secondary)('"Example"') + ' {',
    '    ' + chalk.hex(t.primary)('cycle') + ' {',
    '        ' + chalk.hex(t.accent)('@0,0:') + ' ' + chalk.hex(t.success)('LWI') + ' ' + chalk.hex(t.warning)('R0') + ', input[0];',
    '    }',
    '}',
  ];
  
  return lines.join('\n');
}

/**
 * Print theme code preview panel
 */
export function printThemeCodePreview(themeName: string): void {
  const t = BUILTIN_THEMES[themeName] || getCurrentTheme();
  const code = generateThemePreviewCode(themeName);
  
  console.log(createPanel(code, {
    title: chalk.hex(t.primary)(' ' + t.name + ' '),
    borderColor: t.primary,
    style: 'round',
  }));
}

export function printThemePreview(themeName: string, theme: Theme, active: boolean = false): void {
  const marker = active ? chalk.hex(theme.primary)('● ') : '  ';
  const name = active ? chalk.bold.white(theme.name) : chalk.white(theme.name);
  
  const swatches = 
    chalk.hex(theme.primary)('█') +
    chalk.hex(theme.secondary)('█') +
    chalk.hex(theme.accent)('█') +
    chalk.hex(theme.success)('█') +
    chalk.hex(theme.error)('█') +
    chalk.hex(theme.warning)('█');
  
  console.log('  ' + marker + name.padEnd(20) + swatches);
}

export function printThemeList(themes: { name: string; theme: Theme }[], currentTheme: string): void {
  console.log();
  printHeader('Available Themes');
  console.log();
  
  themes.forEach(t => {
    printThemePreview(t.name, t.theme, t.name === currentTheme);
  });
  
  console.log();
}

// ═══════════════════════════════════════════════════════════════════════════
// FILE DISPLAY
// ═══════════════════════════════════════════════════════════════════════════

export function printFileBadge(filePath: string): void {
  const theme = getCurrentTheme();
  console.log();
  console.log('  ' + chalk.hex(theme.primary)(symbols.file) + ' ' + chalk.white(filePath));
}

export function printRecentFiles(files: { path: string; accessCount: number }[]): void {
  const theme = getCurrentTheme();
  
  if (files.length === 0) {
    console.log('  ' + chalk.hex(theme.dim)('No recent files'));
    return;
  }
  
  files.forEach((file, index) => {
    const num = chalk.hex(theme.dim)(`${index + 1}.`);
    const path = chalk.white(file.path);
    const count = chalk.hex(theme.dim)(`(×${file.accessCount})`);
    console.log(`  ${num} ${path} ${count}`);
  });
}

export function printListItem(text: string, active: boolean = false, indent: number = 2): void {
  const theme = getCurrentTheme();
  const spaces = ' '.repeat(indent);
  const marker = active ? chalk.hex(theme.primary)(symbols.pointer) : chalk.hex(theme.dim)(symbols.dot);
  const textStyle = active ? chalk.white(text) : chalk.hex(theme.dim)(text);
  console.log(spaces + marker + ' ' + textStyle);
}

// ═══════════════════════════════════════════════════════════════════════════
// FILE PREVIEW
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate a syntax-highlighted preview of a DSL file
 */
export function generateFilePreview(content: string, maxLines: number = 6): string {
  const theme = getCurrentTheme();
  const lines = content.split('\n').slice(0, maxLines);
  
  return lines.map((line, i) => {
    const lineNum = String(i + 1).padStart(2);
    const tokens = tokenizeDslLine(line);
    const coloredLine = tokens.map(t => colorizeToken(t, theme)).join('');
    return chalk.hex(theme.dim)(lineNum + ' │ ') + coloredLine;
  }).join('\n');
}

/**
 * Print file preview panel
 */
export function printFilePreviewPanel(fileName: string, content: string): void {
  const theme = getCurrentTheme();
  const preview = generateFilePreview(content, 6);
  
  console.log(createPanel(preview, {
    title: chalk.hex(theme.primary)(' ' + symbols.file + ' ' + fileName + ' '),
    borderColor: theme.dim,
    style: 'round',
  }));
}

// ═══════════════════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

export function clearScreen(): void {
  console.clear();
}

export function printHint(text: string): void {
  const theme = getCurrentTheme();
  console.log('  ' + chalk.hex(theme.dim).italic(text));
}

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

export function printStatusBar(left: string, right?: string): void {
  const theme = getCurrentTheme();
  const width = 50;
  
  console.log();
  console.log('  ' + chalk.hex(theme.dim)('─'.repeat(width)));
  
  if (right) {
    const padding = width - left.length - right.length;
    console.log('  ' + chalk.hex(theme.dim)(left) + ' '.repeat(Math.max(padding, 2)) + chalk.hex(theme.dim)(right));
  } else {
    console.log('  ' + chalk.hex(theme.dim)(left));
  }
}

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

// ═══════════════════════════════════════════════════════════════════════════
// WATCH MODE STATUS BAR
// ═══════════════════════════════════════════════════════════════════════════

export interface WatchStats {
  compiles: number;
  errors: number;
  startTime: number;
  lastStatus: 'ok' | 'error';
}

/**
 * Format elapsed time for display
 */
function formatElapsedTime(startTime: number): string {
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  
  if (elapsed < 60) {
    return `${elapsed}s`;
  }
  
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  
  if (minutes < 60) {
    return `${minutes}m ${seconds}s`;
  }
  
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

/**
 * Create watch mode status bar
 */
export function printWatchStatusBar(stats: WatchStats): void {
  const theme = getCurrentTheme();
  
  const statusIcon = stats.lastStatus === 'ok' 
    ? chalk.hex(theme.success)('●') 
    : chalk.hex(theme.error)('●');
  
  const statusText = stats.lastStatus === 'ok'
    ? chalk.hex(theme.success)('ok')
    : chalk.hex(theme.error)('error');
  
  const compiles = chalk.white(stats.compiles);
  const errors = stats.errors > 0 
    ? chalk.hex(theme.error)(stats.errors) 
    : chalk.hex(theme.dim)('0');
  
  const elapsed = formatElapsedTime(stats.startTime);
  
  const content = 
    `${statusIcon} ${statusText}` +
    chalk.hex(theme.dim)('  │  ') +
    chalk.hex(theme.dim)('compiles: ') + compiles +
    chalk.hex(theme.dim)('  │  ') +
    chalk.hex(theme.dim)('errors: ') + errors +
    chalk.hex(theme.dim)('  │  ') +
    chalk.hex(theme.dim)(elapsed);
  
  const bar = boxen(content + '\n' + chalk.hex(theme.dim)('Ctrl+C to exit'), {
    padding: { left: 1, right: 1, top: 0, bottom: 0 },
    margin: { left: 1, top: 0, bottom: 0, right: 0 },
    borderStyle: 'round',
    borderColor: stats.lastStatus === 'ok' ? theme.success : theme.error,
    dimBorder: true,
  });
  
  console.log(bar);
}

/**
 * Print watch session summary
 */
export function printWatchSummary(stats: WatchStats): void {
  const theme = getCurrentTheme();
  const elapsed = formatElapsedTime(stats.startTime);
  
  const items = [
    { label: 'Duration', value: elapsed },
    { label: 'Compiles', value: String(stats.compiles) },
    { label: 'Errors', value: String(stats.errors) },
  ];
  
  console.log();
  printInfoPanel('Session Summary', items);
}

// ═══════════════════════════════════════════════════════════════════════════
// STARTUP TIPS
// ═══════════════════════════════════════════════════════════════════════════

const STARTUP_TIPS = [
  'Use "openedge watch" for auto-recompile on save',
  'Press Ctrl+C at any time to exit gracefully',
  'Try "openedge theme dracula" for a dark purple theme',
  'Use --json flag for machine-readable output',
  'Recent files are saved for quick access',
  'Check syntax without compiling: openedge check file.dsl',
  'View program stats: openedge info file.dsl',
  'Navigate menus with arrow keys, select with Enter',
  'Settings are stored in ~/.openedge/config.json',
  'Use "openedge compile -o output.csv" to specify output file',
];

/**
 * Print a random startup tip
 */
export function printRandomTip(): void {
  const theme = getCurrentTheme();
  const tip = STARTUP_TIPS[Math.floor(Math.random() * STARTUP_TIPS.length)];
  
  console.log('  ' + chalk.hex(theme.dim)('tip: ') + chalk.hex(theme.accent)(tip));
  console.log();
}

// ═══════════════════════════════════════════════════════════════════════════
// ANIMATED LOGO
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Sleep utility for animations
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Print animated logo with typing effect
 */
export async function printAnimatedLogo(delayMs: number = 40): Promise<void> {
  const { brand } = getThemeGradients();
  const theme = getCurrentTheme();
  
  console.log();
  
  for (const line of LOGO_LINES) {
    console.log('  ' + brand(line));
    await sleep(delayMs);
  }
  
  console.log();
  console.log('  ' + chalk.hex(theme.dim)('CGRA Compiler Toolchain') + 
              chalk.hex(theme.dim)(' · ') + 
              chalk.hex(theme.primary)('v0.1.0'));
  console.log();
}

/**
 * Print animated welcome screen (for first startup)
 */
export async function printWelcomeAnimated(): Promise<void> {
  console.clear();
  await printAnimatedLogo();
  printRandomTip();
  printKeyboardHints([
    { key: '↑↓', action: 'navigate' },
    { key: '⏎', action: 'select' },
    { key: '^C', action: 'exit' },
  ]);
}

export { chalk, gradient, ora };
