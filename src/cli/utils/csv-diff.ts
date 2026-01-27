/**
 * CSV Diff Utility
 * 
 * Compares two CSV outputs and shows differences with color coding.
 */

import chalk from 'chalk';

export interface DiffLine {
  type: 'added' | 'removed' | 'modified' | 'unchanged';
  lineNumber: number;
  oldContent?: string;
  newContent?: string;
  content?: string;
}

export interface DiffResult {
  lines: DiffLine[];
  added: number;
  removed: number;
  modified: number;
  unchanged: number;
  hasChanges: boolean;
}

/**
 * Compare two CSV strings and return diff result
 */
export function diffCsv(oldCsv: string, newCsv: string): DiffResult {
  const oldLines = oldCsv.split('\n').filter(l => l.trim());
  const newLines = newCsv.split('\n').filter(l => l.trim());
  
  const result: DiffResult = {
    lines: [],
    added: 0,
    removed: 0,
    modified: 0,
    unchanged: 0,
    hasChanges: false,
  };

  const maxLines = Math.max(oldLines.length, newLines.length);

  for (let i = 0; i < maxLines; i++) {
    const oldLine = oldLines[i];
    const newLine = newLines[i];

    if (oldLine === undefined && newLine !== undefined) {
      // Added line
      result.lines.push({
        type: 'added',
        lineNumber: i + 1,
        newContent: newLine,
      });
      result.added++;
      result.hasChanges = true;
    } else if (oldLine !== undefined && newLine === undefined) {
      // Removed line
      result.lines.push({
        type: 'removed',
        lineNumber: i + 1,
        oldContent: oldLine,
      });
      result.removed++;
      result.hasChanges = true;
    } else if (oldLine !== newLine) {
      // Modified line
      result.lines.push({
        type: 'modified',
        lineNumber: i + 1,
        oldContent: oldLine,
        newContent: newLine,
      });
      result.modified++;
      result.hasChanges = true;
    } else {
      // Unchanged
      result.lines.push({
        type: 'unchanged',
        lineNumber: i + 1,
        content: oldLine,
      });
      result.unchanged++;
    }
  }

  return result;
}

/**
 * Format diff result for terminal display
 */
export function formatDiff(diff: DiffResult, contextLines: number = 2): string {
  if (!diff.hasChanges) {
    return chalk.dim('  No changes');
  }

  const output: string[] = [];
  const changedIndices = new Set<number>();

  // Find all changed line indices
  diff.lines.forEach((line, i) => {
    if (line.type !== 'unchanged') {
      changedIndices.add(i);
      // Add context around changes
      for (let j = Math.max(0, i - contextLines); j <= Math.min(diff.lines.length - 1, i + contextLines); j++) {
        changedIndices.add(j);
      }
    }
  });

  // Sort indices
  const sortedIndices = Array.from(changedIndices).sort((a, b) => a - b);

  // Format with separators for gaps
  let lastIndex = -1;
  for (const i of sortedIndices) {
    // Add separator if there's a gap
    if (lastIndex >= 0 && i > lastIndex + 1) {
      output.push(chalk.dim('  ···'));
    }

    const line = diff.lines[i];
    const lineNum = String(line.lineNumber).padStart(3, ' ');

    switch (line.type) {
      case 'added':
        output.push(chalk.green(`+ ${lineNum} │ ${line.newContent}`));
        break;
      case 'removed':
        output.push(chalk.red(`- ${lineNum} │ ${line.oldContent}`));
        break;
      case 'modified':
        output.push(chalk.red(`- ${lineNum} │ ${line.oldContent}`));
        output.push(chalk.green(`+ ${lineNum} │ ${line.newContent}`));
        break;
      case 'unchanged':
        output.push(chalk.dim(`  ${lineNum} │ ${line.content}`));
        break;
    }

    lastIndex = i;
  }

  return output.join('\n');
}

/**
 * Format diff summary
 */
export function formatDiffSummary(diff: DiffResult): string {
  if (!diff.hasChanges) {
    return chalk.dim('No changes');
  }

  const parts: string[] = [];
  
  if (diff.added > 0) {
    parts.push(chalk.green(`+${diff.added}`));
  }
  if (diff.removed > 0) {
    parts.push(chalk.red(`-${diff.removed}`));
  }
  if (diff.modified > 0) {
    parts.push(chalk.yellow(`~${diff.modified}`));
  }

  return parts.join(' ');
}
