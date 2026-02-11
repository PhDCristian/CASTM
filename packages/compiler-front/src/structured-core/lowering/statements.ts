import { CycleStatementAst, spanAt } from '@openedge/compiler-ir';
import { parseInstruction } from './instructions.js';
import { evaluateNumericExpression } from '../parser-utils/numbers.js';
import { splitTopLevel } from '../parser-utils/strings.js';

const ADVANCED_NAMES = new Set([
  'route',
  'broadcast',
  'rotate',
  'shift',
  'scan',
  'reduce',
  'stencil',
  'allreduce',
  'transpose',
  'gather',
  'stream_load',
  'stream_store'
]);

export function parseAdvancedStatementAsPragma(clean: string): string | null {
  const match = clean.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*\(([\s\S]*)\)\s*;?\s*$/);
  if (!match) return null;

  const name = match[1].toLowerCase();
  const body = match[2].trim();
  if (!ADVANCED_NAMES.has(name)) return null;
  return `${name}(${body})`;
}

export function parseCycleStatement(
  clean: string,
  line: number,
  rawLine: string,
  constants: ReadonlyMap<string, number>,
  bindings: ReadonlyMap<string, number>
): CycleStatementAst | null {
  const atMatch = clean.match(/^(?:at\s+)?@\s*([^,]+)\s*,\s*([^:]+)\s*:\s*(.+);\s*$/i);
  if (atMatch) {
    const row = evaluateNumericExpression(atMatch[1].trim(), constants, bindings);
    const col = evaluateNumericExpression(atMatch[2].trim(), constants, bindings);
    if (row === null || col === null) return null;
    const instructionText = atMatch[3].trim();
    const column = Math.max(1, rawLine.indexOf(instructionText) + 1);
    return {
      kind: 'at',
      row,
      col,
      instruction: parseInstruction(instructionText, line, column),
      span: spanAt(line, 1, clean.length)
    };
  }

  const rowMatch = clean.match(/^at\s+row\s+([^:]+)\s*:\s*(.+);\s*$/i);
  if (rowMatch) {
    const row = evaluateNumericExpression(rowMatch[1].trim(), constants, bindings);
    if (row === null) return null;
    const payload = rowMatch[2].trim();
    const segments = splitTopLevel(payload, '|').map((s) => s.trim());
    return {
      kind: 'row',
      row,
      instructions: segments.map((segment) => parseInstruction(segment, line, Math.max(1, rawLine.indexOf(segment) + 1))),
      span: spanAt(line, 1, clean.length)
    };
  }

  const colMatch = clean.match(/^at\s+col\s+([^:]+)\s*:\s*(.+);\s*$/i);
  if (colMatch) {
    const col = evaluateNumericExpression(colMatch[1].trim(), constants, bindings);
    if (col === null) return null;
    const instructionText = colMatch[2].trim();
    return {
      kind: 'col',
      col,
      instruction: parseInstruction(instructionText, line, Math.max(1, rawLine.indexOf(instructionText) + 1)),
      span: spanAt(line, 1, clean.length)
    };
  }

  const allMatch = clean.match(/^at\s+all\s*:\s*(.+);\s*$/i);
  if (allMatch) {
    const instructionText = allMatch[1].trim();
    return {
      kind: 'all',
      instruction: parseInstruction(instructionText, line, Math.max(1, rawLine.indexOf(instructionText) + 1)),
      span: spanAt(line, 1, clean.length)
    };
  }

  return null;
}
