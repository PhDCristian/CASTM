/**
 * TUI Theme - Color definitions for Ink components
 */

import { getCurrentTheme } from '../config/store.js';

export function useTheme() {
  return getCurrentTheme();
}

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
  pointer: '❯',
  
  // Structure
  line: '│',
  corner: '└',
  tee: '├',
  dash: '─',
  dot: '·',
  bullet: '•',
  
  // Objects
  file: '◇',
  fileActive: '◆',
  folder: '▪',
  folderOpen: '▫',
  
  // Box drawing
  boxTopLeft: '╭',
  boxTopRight: '╮',
  boxBottomLeft: '╰',
  boxBottomRight: '╯',
  boxHorizontal: '─',
  boxVertical: '│',
};
