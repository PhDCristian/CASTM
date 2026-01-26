/**
 * File utilities for CLI
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname, basename, extname } from 'path';

/**
 * Result of reading a file
 */
export interface ReadResult {
  success: boolean;
  content?: string;
  error?: string;
  path: string;
}

/**
 * Result of writing a file
 */
export interface WriteResult {
  success: boolean;
  error?: string;
  path: string;
}

/**
 * Reads a file and returns its content
 */
export function readFile(filePath: string): ReadResult {
  const absolutePath = resolve(filePath);
  
  if (!existsSync(absolutePath)) {
    return {
      success: false,
      error: `File not found: ${filePath}`,
      path: absolutePath,
    };
  }
  
  try {
    const content = readFileSync(absolutePath, 'utf-8');
    return {
      success: true,
      content,
      path: absolutePath,
    };
  } catch (err) {
    return {
      success: false,
      error: `Failed to read file: ${(err as Error).message}`,
      path: absolutePath,
    };
  }
}

/**
 * Writes content to a file
 */
export function writeFile(filePath: string, content: string): WriteResult {
  const absolutePath = resolve(filePath);
  
  try {
    writeFileSync(absolutePath, content, 'utf-8');
    return {
      success: true,
      path: absolutePath,
    };
  } catch (err) {
    return {
      success: false,
      error: `Failed to write file: ${(err as Error).message}`,
      path: absolutePath,
    };
  }
}

/**
 * Gets the output path for a compiled file
 * Replaces .dsl extension with .csv, or appends .csv if no .dsl extension
 */
export function getOutputPath(inputPath: string, outputPath?: string): string {
  if (outputPath) {
    return resolve(outputPath);
  }
  
  const dir = dirname(inputPath);
  const ext = extname(inputPath);
  const base = basename(inputPath, ext);
  
  return resolve(dir, `${base}.csv`);
}

/**
 * Checks if a file has a .dsl extension
 */
export function isDslFile(filePath: string): boolean {
  return extname(filePath).toLowerCase() === '.dsl';
}

/**
 * Gets relative path from current directory
 */
export function getRelativePath(absolutePath: string): string {
  const cwd = process.cwd();
  if (absolutePath.startsWith(cwd)) {
    return absolutePath.slice(cwd.length + 1);
  }
  return absolutePath;
}
