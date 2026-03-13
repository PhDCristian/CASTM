import { CycleAst } from '@castm/compiler-ir';
import type { ParsedCondition } from '../control-flow.js';
import { cycleHasControlFlow } from './cycle.js';

function getWhileFusionIncomingRegister(
  controlRow: number,
  controlCol: number,
  bodyRow: number,
  bodyCol: number
): string | null {
  if (bodyRow === controlRow) {
    if (((controlCol + 1) % 4) === bodyCol) return 'RCR';
    if (((controlCol + 3) % 4) === bodyCol) return 'RCL';
    return null;
  }

  if (bodyCol !== controlCol) return null;
  if (bodyRow === controlRow - 1) return 'RCT';
  if (bodyRow === controlRow + 1) return 'RCB';
  return null;
}

export function buildWhileFusionPlan(
  loopCycles: CycleAst[],
  controlRow: number,
  controlCol: number
): { bodyRow: number; bodyCol: number; incomingRegister: string } | null {
  if (loopCycles.length !== 1) return null;
  const cycle = loopCycles[0];
  if (cycle.label) return null;
  if (cycleHasControlFlow(cycle)) return null;
  if (cycle.statements.length !== 1) return null;

  const statement = cycle.statements[0];
  if (statement.kind !== 'at') return null;
  if (statement.row === controlRow && statement.col === controlCol) return null;
  const incomingRegister = getWhileFusionIncomingRegister(controlRow, controlCol, statement.row, statement.col);
  if (!incomingRegister) return null;
  return {
    bodyRow: statement.row,
    bodyCol: statement.col,
    incomingRegister
  };
}

export function rewriteConditionForWhileFusion(condition: ParsedCondition, incomingRegister: string): ParsedCondition {
  const replace = (operand: string): string => /^R\d+$/i.test(operand) ? incomingRegister : operand;
  return {
    lhs: replace(condition.lhs),
    operator: condition.operator,
    rhs: replace(condition.rhs)
  };
}
