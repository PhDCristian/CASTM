/**
 * Configuration and state management
 * Stores recent files, themes, and user preferences
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join, resolve } from 'path';

// Config directory
const CONFIG_DIR = join(homedir(), '.openedge');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');
const HISTORY_FILE = join(CONFIG_DIR, 'history.json');

// Theme definitions
export interface Theme {
  name: string;
  primary: string;
  secondary: string;
  accent: string;
  success: string;
  error: string;
  warning: string;
  dim: string;
  background?: string;
}

export const BUILTIN_THEMES: Record<string, Theme> = {
  default: {
    name: 'Default',
    primary: '#00d9ff',
    secondary: '#00ff87',
    accent: '#667eea',
    success: '#00ff87',
    error: '#ff6b6b',
    warning: '#ffa502',
    dim: '#666666',
  },
  ocean: {
    name: 'Ocean',
    primary: '#0077b6',
    secondary: '#00b4d8',
    accent: '#90e0ef',
    success: '#06d6a0',
    error: '#ef476f',
    warning: '#ffd166',
    dim: '#5c677d',
  },
  sunset: {
    name: 'Sunset',
    primary: '#ff6b6b',
    secondary: '#feca57',
    accent: '#ff9ff3',
    success: '#1dd1a1',
    error: '#ee5a24',
    warning: '#f39c12',
    dim: '#636e72',
  },
  nord: {
    name: 'Nord',
    primary: '#88c0d0',
    secondary: '#a3be8c',
    accent: '#b48ead',
    success: '#a3be8c',
    error: '#bf616a',
    warning: '#ebcb8b',
    dim: '#4c566a',
  },
  dracula: {
    name: 'Dracula',
    primary: '#bd93f9',
    secondary: '#50fa7b',
    accent: '#ff79c6',
    success: '#50fa7b',
    error: '#ff5555',
    warning: '#f1fa8c',
    dim: '#6272a4',
  },
  monokai: {
    name: 'Monokai',
    primary: '#66d9ef',
    secondary: '#a6e22e',
    accent: '#f92672',
    success: '#a6e22e',
    error: '#f92672',
    warning: '#fd971f',
    dim: '#75715e',
  },
  cyberpunk: {
    name: 'Cyberpunk',
    primary: '#00fff9',
    secondary: '#ff00ff',
    accent: '#ffff00',
    success: '#00ff00',
    error: '#ff0000',
    warning: '#ff6600',
    dim: '#666666',
  },
  minimal: {
    name: 'Minimal',
    primary: '#ffffff',
    secondary: '#cccccc',
    accent: '#999999',
    success: '#00ff00',
    error: '#ff0000',
    warning: '#ffff00',
    dim: '#555555',
  },
};

// Config structure
export interface Config {
  theme: string;
  recentFilesLimit: number;
  watchDebounceMs: number;
  clearScreenOnAction: boolean;
  showSpinners: boolean;
  compactMode: boolean;
}

// History structure
export interface HistoryEntry {
  path: string;
  lastAccessed: number;
  accessCount: number;
}

export interface History {
  recentFiles: HistoryEntry[];
  lastDirectory: string;
}

// Default values
const DEFAULT_CONFIG: Config = {
  theme: 'default',
  recentFilesLimit: 10,
  watchDebounceMs: 300,
  clearScreenOnAction: true,
  showSpinners: true,
  compactMode: false,
};

const DEFAULT_HISTORY: History = {
  recentFiles: [],
  lastDirectory: process.cwd(),
};

/**
 * Ensure config directory exists
 */
function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

/**
 * Load configuration
 */
export function loadConfig(): Config {
  ensureConfigDir();
  
  if (existsSync(CONFIG_FILE)) {
    try {
      const data = readFileSync(CONFIG_FILE, 'utf-8');
      return { ...DEFAULT_CONFIG, ...JSON.parse(data) };
    } catch {
      return DEFAULT_CONFIG;
    }
  }
  
  return DEFAULT_CONFIG;
}

/**
 * Save configuration
 */
export function saveConfig(config: Config): void {
  ensureConfigDir();
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

/**
 * Load history
 */
export function loadHistory(): History {
  ensureConfigDir();
  
  if (existsSync(HISTORY_FILE)) {
    try {
      const data = readFileSync(HISTORY_FILE, 'utf-8');
      return { ...DEFAULT_HISTORY, ...JSON.parse(data) };
    } catch {
      return DEFAULT_HISTORY;
    }
  }
  
  return DEFAULT_HISTORY;
}

/**
 * Save history
 */
export function saveHistory(history: History): void {
  ensureConfigDir();
  writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
}

/**
 * Add file to recent history
 */
export function addRecentFile(filePath: string): void {
  const config = loadConfig();
  const history = loadHistory();
  const absolutePath = resolve(filePath);
  
  // Find existing entry or create new
  const existingIndex = history.recentFiles.findIndex(f => f.path === absolutePath);
  
  if (existingIndex >= 0) {
    // Update existing
    history.recentFiles[existingIndex].lastAccessed = Date.now();
    history.recentFiles[existingIndex].accessCount++;
    
    // Move to front
    const [entry] = history.recentFiles.splice(existingIndex, 1);
    history.recentFiles.unshift(entry);
  } else {
    // Add new
    history.recentFiles.unshift({
      path: absolutePath,
      lastAccessed: Date.now(),
      accessCount: 1,
    });
  }
  
  // Limit size
  history.recentFiles = history.recentFiles.slice(0, config.recentFilesLimit);
  
  saveHistory(history);
}

/**
 * Get recent files (only existing ones)
 */
export function getRecentFiles(): HistoryEntry[] {
  const history = loadHistory();
  
  // Filter out non-existing files
  const existing = history.recentFiles.filter(f => existsSync(f.path));
  
  // Update history if files were removed
  if (existing.length !== history.recentFiles.length) {
    history.recentFiles = existing;
    saveHistory(history);
  }
  
  return existing;
}

/**
 * Clear recent files
 */
export function clearRecentFiles(): void {
  const history = loadHistory();
  history.recentFiles = [];
  saveHistory(history);
}

/**
 * Get/set last directory
 */
export function getLastDirectory(): string {
  return loadHistory().lastDirectory;
}

export function setLastDirectory(dir: string): void {
  const history = loadHistory();
  history.lastDirectory = resolve(dir);
  saveHistory(history);
}

/**
 * Get current theme
 */
export function getCurrentTheme(): Theme {
  const config = loadConfig();
  return BUILTIN_THEMES[config.theme] || BUILTIN_THEMES.default;
}

/**
 * Set theme
 */
export function setTheme(themeName: string): boolean {
  if (!BUILTIN_THEMES[themeName]) {
    return false;
  }
  
  const config = loadConfig();
  config.theme = themeName;
  saveConfig(config);
  return true;
}

/**
 * Get all theme names
 */
export function getThemeNames(): string[] {
  return Object.keys(BUILTIN_THEMES);
}
