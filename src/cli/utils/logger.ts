/**
 * CLI Logger with colored output
 * 
 * Uses ANSI escape codes for professional terminal styling.
 */

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  underline: '\x1b[4m',
  
  // Foreground colors
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  
  // Background colors
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
} as const;

// Symbols for different message types
const symbols = {
  success: '\u2713', // ✓
  error: '\u2717',   // ✗
  warning: '\u26A0', // ⚠
  info: '\u2139',    // ℹ
  arrow: '\u2192',   // →
  bullet: '\u2022',  // •
} as const;

// Check if colors should be disabled
const supportsColor = process.env.NO_COLOR === undefined && 
                      process.env.FORCE_COLOR !== '0' &&
                      process.stdout.isTTY;

/**
 * Applies color to text if colors are supported
 */
function colorize(text: string, color: string): string {
  if (!supportsColor) return text;
  return `${color}${text}${colors.reset}`;
}

/**
 * Formats a label with consistent width
 */
function formatLabel(label: string, width: number = 12): string {
  return label.padEnd(width);
}

/**
 * Logger instance with all logging methods
 */
export const logger = {
  /**
   * Print success message with green checkmark
   */
  success(message: string): void {
    const symbol = colorize(symbols.success, colors.green);
    console.log(`  ${symbol} ${message}`);
  },

  /**
   * Print error message with red X
   */
  error(message: string): void {
    const symbol = colorize(symbols.error, colors.red);
    console.error(`  ${symbol} ${message}`);
  },

  /**
   * Print warning message with yellow symbol
   */
  warn(message: string): void {
    const symbol = colorize(symbols.warning, colors.yellow);
    console.log(`  ${symbol} ${message}`);
  },

  /**
   * Print info message with blue symbol
   */
  info(message: string): void {
    const symbol = colorize(symbols.info, colors.cyan);
    console.log(`  ${symbol} ${message}`);
  },

  /**
   * Print dimmed/secondary text
   */
  dim(message: string): void {
    console.log(colorize(`  ${message}`, colors.dim));
  },

  /**
   * Print a blank line
   */
  newline(): void {
    console.log();
  },

  /**
   * Print the CLI header with version
   */
  header(version: string): void {
    console.log();
    const name = colorize('OpenEdgeDSL', colors.bold);
    const ver = colorize(`v${version}`, colors.dim);
    console.log(`  ${name} ${ver}`);
    console.log();
  },

  /**
   * Print a key-value pair with consistent formatting
   */
  property(label: string, value: string | number, indent: number = 4): void {
    const spaces = ' '.repeat(indent);
    const labelText = colorize(formatLabel(label + ':'), colors.dim);
    console.log(`${spaces}${labelText} ${value}`);
  },

  /**
   * Print compilation statistics
   */
  stats(stats: {
    output?: string;
    cycles?: number;
    memoryRegions?: number;
    assertions?: number;
    grid?: { width: number; height: number };
    time?: number;
  }): void {
    console.log();
    if (stats.output) {
      this.property('Output', stats.output);
    }
    if (stats.cycles !== undefined) {
      this.property('Cycles', stats.cycles);
    }
    if (stats.grid) {
      this.property('Grid', `${stats.grid.width}\u00D7${stats.grid.height}`);
    }
    if (stats.memoryRegions !== undefined) {
      this.property('Memory', `${stats.memoryRegions} region${stats.memoryRegions !== 1 ? 's' : ''}`);
    }
    if (stats.assertions !== undefined && stats.assertions > 0) {
      this.property('Assertions', stats.assertions);
    }
    console.log();
    if (stats.time !== undefined) {
      const timeText = colorize(`Done in ${stats.time.toFixed(0)}ms`, colors.dim);
      console.log(`  ${timeText}`);
    }
    console.log();
  },

  /**
   * Print a code frame showing the error location
   */
  codeFrame(
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
      const location = colorize(`${filePath}:${line}:${column}`, colors.cyan);
      console.log(`    ${location}`);
      console.log();
    }

    // Code context
    for (let i = startLine; i < endLine; i++) {
      const lineNum = i + 1;
      const isErrorLine = lineNum === line;
      const lineNumStr = String(lineNum).padStart(5);
      
      if (isErrorLine) {
        // Error line with marker
        const marker = colorize('>', colors.red);
        const numText = colorize(lineNumStr, colors.red);
        console.log(`  ${marker} ${numText} ${colors.dim}|${colors.reset} ${lines[i]}`);
        
        // Underline the error position
        const spaces = ' '.repeat(column - 1);
        const underline = colorize('^'.repeat(Math.max(1, 2)), colors.red);
        console.log(`          ${colors.dim}|${colors.reset} ${spaces}${underline}`);
      } else {
        // Context line
        const numText = colorize(lineNumStr, colors.dim);
        console.log(`    ${numText} ${colors.dim}|${colors.reset} ${lines[i]}`);
      }
    }
    
    console.log();
    
    // Error message
    const errorLabel = colorize('Error:', colors.red + colors.bold);
    console.log(`    ${errorLabel} ${message}`);
    console.log();
  },

  /**
   * Print table of data
   */
  table(data: Record<string, string | number>): void {
    console.log();
    for (const [key, value] of Object.entries(data)) {
      this.property(key, String(value));
    }
    console.log();
  },
};

export { colors, symbols };
