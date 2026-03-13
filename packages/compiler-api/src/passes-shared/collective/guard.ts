import {
  CycleAst,
  Diagnostic,
  ErrorCodes,
  GridSpec,
  SourceSpan,
  makeDiagnostic
} from '@castm/compiler-ir';
import {
  GuardPragmaArgs
} from '../advanced-args.js';
import {
  createInstruction,
  createMultiAtCycle
} from '../ast-utils.js';

const IDENT_RE = /\b[A-Za-z_][A-Za-z0-9_]*\b/g;

type Comparator = '==' | '!=' | '>=' | '<=' | '>' | '<';

interface ParsedConditionTruthy {
  comparator: null;
  lhs: string;
}

interface ParsedConditionCompare {
  comparator: Comparator;
  lhs: string;
  rhs: string;
}

type ParsedCondition = ParsedConditionTruthy | ParsedConditionCompare;

function findTopLevelComparator(condition: string): { index: number; operator: Comparator } | null {
  let depth = 0;
  for (let i = 0; i < condition.length; i++) {
    const ch = condition[i];
    if (ch === '(') {
      depth++;
      continue;
    }
    if (ch === ')') {
      depth = Math.max(0, depth - 1);
      continue;
    }
    if (depth !== 0) continue;

    const pair = condition.slice(i, i + 2);
    if (pair === '==' || pair === '!=' || pair === '>=' || pair === '<=') {
      return { index: i, operator: pair as Comparator };
    }
    if (ch === '>' || ch === '<') {
      return { index: i, operator: ch as Comparator };
    }
  }
  return null;
}

function parseCondition(condition: string): ParsedCondition | null {
  const trimmed = condition.trim();
  if (!trimmed) return null;

  const comparator = findTopLevelComparator(trimmed);
  if (!comparator) {
    return { comparator: null, lhs: trimmed };
  }

  const lhs = trimmed.slice(0, comparator.index).trim();
  const rhs = trimmed.slice(comparator.index + comparator.operator.length).trim();
  if (!lhs || !rhs) return null;

  return {
    comparator: comparator.operator,
    lhs,
    rhs
  };
}

function evaluateNumericExpression(expression: string, bindings: Record<string, number>): number | null {
  const unresolved: string[] = [];
  const replaced = expression.replace(IDENT_RE, (name) => {
    if (Object.prototype.hasOwnProperty.call(bindings, name)) {
      return String(bindings[name]);
    }
    unresolved.push(name);
    return name;
  });

  if (unresolved.length > 0) return null;
  if (!/^[0-9a-fA-FxX+\-*/%()\s]+$/.test(replaced)) return null;

  try {
    const value = Function(`"use strict"; return (${replaced});`)();
    if (typeof value !== 'number' || !Number.isFinite(value)) return null;
    return value;
  } catch {
    return null;
  }
}

function matchesCondition(parsed: ParsedCondition, bindings: Record<string, number>): boolean | null {
  const lhs = evaluateNumericExpression(parsed.lhs, bindings);
  if (lhs === null) return null;

  if (!parsed.comparator) {
    return lhs !== 0;
  }

  const rhs = evaluateNumericExpression(parsed.rhs, bindings);
  if (rhs === null) return null;

  switch (parsed.comparator) {
    case '==': return lhs === rhs;
    case '!=': return lhs !== rhs;
    case '>=': return lhs >= rhs;
    case '<=': return lhs <= rhs;
    case '>': return lhs > rhs;
    case '<': return lhs < rhs;
  }
}

export function buildGuardCycles(
  pragma: GuardPragmaArgs,
  startIndex: number,
  grid: GridSpec,
  span: SourceSpan,
  diagnostics: Diagnostic[]
): CycleAst[] {
  const parsed = parseCondition(pragma.condition);
  if (!parsed) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      span,
      `Invalid guard condition '${pragma.condition}'.`,
      'Use a numeric predicate over row/col/idx (for example cond=col>=row or cond=(idx%2)==0).'
    ));
    return [];
  }

  const placements: Array<{ row: number; col: number; instruction: ReturnType<typeof createInstruction> }> = [];

  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      const bindings = {
        row,
        col,
        idx: row * grid.cols + col,
        rows: grid.rows,
        cols: grid.cols
      };
      const matches = matchesCondition(parsed, bindings);
      if (matches === null) {
        diagnostics.push(makeDiagnostic(
          ErrorCodes.Parse.InvalidSyntax,
          'error',
          span,
          `Guard condition '${pragma.condition}' is not evaluable for spatial bindings.`,
          'Use only row/col/idx/rows/cols, integer literals and arithmetic operators.'
        ));
        return [];
      }
      if (!matches) continue;

      placements.push({
        row,
        col,
        instruction: createInstruction(
          pragma.opcode,
          [pragma.destReg, pragma.srcA, pragma.srcB],
          span
        )
      });
    }
  }

  if (placements.length === 0) return [];
  return [createMultiAtCycle(startIndex, placements, span)];
}
