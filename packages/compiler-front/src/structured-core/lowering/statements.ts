import { CycleStatementAst, InstructionAst, spanAt } from '@castm/compiler-ir';
import { parseInstruction } from './instructions.js';
import { evaluateCoordinateExpression, evaluateNumericExpression } from '../parser-utils/numbers.js';
import { splitTopLevel } from '../parser-utils/strings.js';
import { parseAdvancedNamespaceIssue, parseStandardAdvancedCall } from '../advanced.js';

export function parseAdvancedStatementAsPragma(clean: string): string | null {
  const parsed = parseStandardAdvancedCall(clean);
  if (!parsed) return null;
  return parsed.text;
}

export { parseAdvancedNamespaceIssue, parseStandardAdvancedCall };

function findTopLevelRangeSeparator(expr: string): number {
  let paren = 0;
  let bracket = 0;
  let brace = 0;

  for (let index = 0; index < expr.length - 1; index++) {
    const ch = expr[index];
    const next = expr[index + 1];

    if (ch === '(') paren++;
    else if (ch === ')') paren = Math.max(0, paren - 1);
    else if (ch === '[') bracket++;
    else if (ch === ']') bracket = Math.max(0, bracket - 1);
    else if (ch === '{') brace++;
    else if (ch === '}') brace = Math.max(0, brace - 1);

    if (ch === '.' && next === '.' && paren === 0 && bracket === 0 && brace === 0) {
      return index;
    }
  }

  return -1;
}

function parseCoordinateRange(
  expr: string,
  constants: ReadonlyMap<string, number>,
  bindings: ReadonlyMap<string, number>
): { start: number; end: number } | null | undefined {
  const separator = findTopLevelRangeSeparator(expr);
  if (separator < 0) return undefined;

  const startExpr = expr.slice(0, separator).trim();
  const endExpr = expr.slice(separator + 2).trim();
  if (!startExpr || !endExpr) return null;

  const start = evaluateCoordinateExpression(startExpr, constants, bindings);
  const end = evaluateCoordinateExpression(endExpr, constants, bindings);
  if (start === null || end === null) return null;

  return { start, end };
}

function expandInclusiveRange(start: number, end: number): number[] {
  const step = start <= end ? 1 : -1;
  const values: number[] = [];
  for (let value = start; step > 0 ? value <= end : value >= end; value += step) {
    values.push(value);
  }
  return values;
}

function cloneInstruction(instruction: InstructionAst): InstructionAst {
  return {
    ...instruction,
    operands: [...instruction.operands],
    span: { ...instruction.span }
  };
}

type CoordinateValue = number | string;

export function parseCycleStatement(
  clean: string,
  line: number,
  rawLine: string,
  constants: ReadonlyMap<string, number>,
  bindings: ReadonlyMap<string, number>
): CycleStatementAst[] | null {
  const atMatch = clean.match(/^(?:at\s+)?@\s*([^,]+)\s*,\s*([^:]+)\s*:\s*(.+);\s*$/i);
  if (atMatch) {
    const rowExpr = atMatch[1].trim();
    const colExpr = atMatch[2].trim();
    const instructionText = atMatch[3].trim();
    const column = Math.max(1, rawLine.indexOf(instructionText) + 1);
    const instruction = parseInstruction(instructionText, line, column);
    const span = spanAt(line, 1, clean.length);

    const rowRange = parseCoordinateRange(rowExpr, constants, bindings);
    const colRange = parseCoordinateRange(colExpr, constants, bindings);
    const hasRange = rowRange !== undefined || colRange !== undefined;

    if (!hasRange) {
      const row = evaluateCoordinateExpression(rowExpr, constants, bindings);
      const col = evaluateCoordinateExpression(colExpr, constants, bindings);
      if (row === null || col === null) {
        return [{
          kind: 'at-expr',
          rowExpr,
          colExpr,
          instruction,
          span
        }];
      }

      return [{
        kind: 'at',
        row,
        col,
        instruction,
        span
      }];
    }

    if (rowRange === null || colRange === null) return null;

    const rowValues: CoordinateValue[] = rowRange
      ? expandInclusiveRange(rowRange.start, rowRange.end)
      : (() => {
        const value = evaluateCoordinateExpression(rowExpr, constants, bindings);
        return value === null ? [rowExpr] : [value];
      })();
    const colValues: CoordinateValue[] = colRange
      ? expandInclusiveRange(colRange.start, colRange.end)
      : (() => {
        const value = evaluateCoordinateExpression(colExpr, constants, bindings);
        return value === null ? [colExpr] : [value];
      })();

    const statements: CycleStatementAst[] = [];
    for (const rowValue of rowValues) {
      for (const colValue of colValues) {
        if (typeof rowValue === 'number' && typeof colValue === 'number') {
          statements.push({
            kind: 'at',
            row: rowValue,
            col: colValue,
            instruction: cloneInstruction(instruction),
            span: { ...span }
          });
          continue;
        }

        statements.push({
          kind: 'at-expr',
          rowExpr: typeof rowValue === 'number' ? String(rowValue) : rowValue,
          colExpr: typeof colValue === 'number' ? String(colValue) : colValue,
          instruction: cloneInstruction(instruction),
          span: { ...span }
        });
      }
    }

    return statements;
  }

  const rowMatch = clean.match(/^at\s+row\s+([^:]+)\s*:\s*(.+);\s*$/i);
  if (rowMatch) {
    const row = evaluateNumericExpression(rowMatch[1].trim(), constants, bindings);
    if (row === null) return null;
    const payload = rowMatch[2].trim();
    const segments = splitTopLevel(payload, '|').map((s) => s.trim());
    return [{
      kind: 'row',
      row,
      instructions: segments.map((segment) => parseInstruction(segment, line, Math.max(1, rawLine.indexOf(segment) + 1))),
      span: spanAt(line, 1, clean.length)
    }];
  }

  const colMatch = clean.match(/^at\s+col\s+([^:]+)\s*:\s*(.+);\s*$/i);
  if (colMatch) {
    const col = evaluateNumericExpression(colMatch[1].trim(), constants, bindings);
    if (col === null) return null;
    const instructionText = colMatch[2].trim();
    return [{
      kind: 'col',
      col,
      instruction: parseInstruction(instructionText, line, Math.max(1, rawLine.indexOf(instructionText) + 1)),
      span: spanAt(line, 1, clean.length)
    }];
  }

  const allMatch = clean.match(/^at\s+all\s*:\s*(.+);\s*$/i);
  if (allMatch) {
    const instructionText = allMatch[1].trim();
    return [{
      kind: 'all',
      instruction: parseInstruction(instructionText, line, Math.max(1, rawLine.indexOf(instructionText) + 1)),
      span: spanAt(line, 1, clean.length)
    }];
  }

  return null;
}
