/**
 * TUI Theme - Premium Vercel/Next.js Style
 * Modern Unicode symbols and vibrant color palette
 */

import { getCurrentTheme } from '../config/store.js';

export function useTheme() {
  return getCurrentTheme();
}

// Modern Unicode symbols - Vercel/Next.js style
export const symbols = {
  // Status indicators (clean, minimal)
  success: '✓',
  error: '✗',
  warning: '⚠',
  info: '●',
  pending: '○',
  running: '◐',
  
  // Navigation arrows (sleek)
  arrow: '→',
  arrowLeft: '←',
  arrowUp: '↑',
  arrowDown: '↓',
  arrowRight: '→',
  arrowRightDouble: '»',
  pointer: '▶',
  chevronRight: '›',
  chevronDown: '⌄',
  
  // Structure & Lines (box drawing)
  line: '│',
  lineDouble: '║',
  corner: '└',
  cornerTop: '┌',
  tee: '├',
  teeRight: '┤',
  cross: '┼',
  dash: '─',
  dashDouble: '═',
  dot: '·',
  dotLarge: '●',
  bullet: '•',
  
  // Checkboxes (modern)
  boxEmpty: '○',
  boxChecked: '●',
  boxFilled: '◉',
  boxOutline: '◯',
  
  // Files & Folders
  file: '◇',
  fileActive: '◆',
  fileFilled: '◆',
  folder: '▸',
  folderOpen: '▾',
  folderTree: '├',
  
  // Hardware / CGRA specific
  chip: '▣',
  chipActive: '◈',
  processor: '◉',
  processorIdle: '○',
  memory: '▤',
  connection: '─',
  connectionVertical: '│',
  connectionCorner: '└',
  signal: '∿',
  
  // Progress & Loading
  progressEmpty: '░',
  progressFilled: '█',
  progressHalf: '▓',
  spinner: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
  
  // Box drawing (rounded corners - Vercel style)
  boxTopLeft: '╭',
  boxTopRight: '╮',
  boxBottomLeft: '╰',
  boxBottomRight: '╯',
  boxHorizontal: '─',
  boxVertical: '│',
  
  // Separators
  separator: '─',
  separatorDouble: '═',
  separatorDot: '·',
  
  // Misc
  star: '★',
  starEmpty: '☆',
  lightning: '⚡',
  gear: '⚙',
  key: '⌘',
  enter: '↵',
  escape: 'esc',
  tab: '⇥',
  space: '␣',
  
  // Badges/Tags
  tagLeft: '⟨',
  tagRight: '⟩',
  
  // Grid cells
  cellEmpty: '·',
  cellActive: '●',
  cellCompute: '◆',
  cellMemory: '◇',
};

// Semantic color helpers
export const statusColors = {
  ok: 'success',
  error: 'error', 
  warn: 'warning',
  info: 'primary',
  muted: 'dim',
} as const;

// Vercel-style gradients (vibrant)
export const gradients = {
  primary: ['#00d9ff', '#7928ca'],      // Cyan to Purple
  secondary: ['#ff0080', '#7928ca'],    // Pink to Purple
  success: ['#00ff87', '#00d9ff'],      // Green to Cyan
  error: ['#ff0055', '#ff4444'],        // Red gradient
  warning: ['#f5a623', '#ff6b00'],      // Orange gradient
  purple: ['#7928ca', '#ff0080'],       // Purple to Pink
  ocean: ['#0070f3', '#00d9ff'],        // Vercel blue
  rainbow: ['#ff0080', '#7928ca', '#0070f3', '#00d9ff', '#00ff87'],
};

// Animation timing constants
export const timing = {
  fast: 80,
  normal: 150,
  slow: 300,
  splash: 2000,
  spinnerInterval: 80,
};

// Premium Vercel-style color palette
export const premiumColors = {
  // Backgrounds (dark, clean)
  bgDark: '#000000',
  bgMedium: '#111111',
  bgLight: '#1a1a1a',
  bgHighlight: '#1f1f1f',
  bgHover: '#252525',
  
  // Borders (subtle)
  borderDim: '#333333',
  borderNormal: '#444444',
  borderBright: '#555555',
  borderAccent: '#0070f3',
  
  // Text (high contrast)
  textBright: '#ffffff',
  textNormal: '#ededed',
  textMuted: '#888888',
  textDim: '#666666',
  
  // Vercel accent colors
  accentBlue: '#0070f3',      // Vercel primary
  accentCyan: '#00d9ff',      // Bright cyan
  accentPink: '#ff0080',      // Hot pink
  accentPurple: '#7928ca',    // Purple
  accentGreen: '#00ff87',     // Success green
  accentOrange: '#f5a623',    // Warning orange
  accentRed: '#ff0055',       // Error red
  accentYellow: '#ffcc00',    // Highlight yellow
  
  // Status colors
  statusSuccess: '#00ff87',
  statusError: '#ff0055',
  statusWarning: '#f5a623',
  statusInfo: '#0070f3',
};

// Spinner frames for different contexts
export const spinnerFrames = {
  dots: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
  line: ['|', '/', '-', '\\'],
  bounce: ['⠁', '⠂', '⠄', '⡀', '⢀', '⠠', '⠐', '⠈'],
  grow: ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█', '▇', '▆', '▅', '▄', '▃', '▂'],
  pulse: ['○', '◔', '◑', '◕', '●', '◕', '◑', '◔'],
};

// Progress bar styles
export const progressStyles = {
  block: { filled: '█', empty: '░', half: '▓' },
  line: { filled: '━', empty: '─', half: '╍' },
  dot: { filled: '●', empty: '○', half: '◐' },
};

// Box border styles for Panel component
export const boxStyles = {
  rounded: {
    topLeft: '╭',
    topRight: '╮',
    bottomLeft: '╰',
    bottomRight: '╯',
    horizontal: '─',
    vertical: '│',
  },
  sharp: {
    topLeft: '┌',
    topRight: '┐',
    bottomLeft: '└',
    bottomRight: '┘',
    horizontal: '─',
    vertical: '│',
  },
  double: {
    topLeft: '╔',
    topRight: '╗',
    bottomLeft: '╚',
    bottomRight: '╝',
    horizontal: '═',
    vertical: '║',
  },
  heavy: {
    topLeft: '┏',
    topRight: '┓',
    bottomLeft: '┗',
    bottomRight: '┛',
    horizontal: '━',
    vertical: '┃',
  },
};
