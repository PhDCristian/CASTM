import {
  CycleAst,
  Diagnostic
} from '@openedge/compiler-ir';
import { spanAt } from '@openedge/compiler-ir';
import type { ParsedCondition } from './control-flow.js';
import { bindFunctionCallArgs } from './functions.js';
import { parseInstruction } from './instructions.js';
import {
  FunctionDefinitionLike
} from './for-expand.js';
import { SourceLineEntry } from '../parser-utils/blocks.js';
import { escapeRegExp } from '../parser-utils/strings.js';

const CONTROL_FLOW_OPCODES = new Set(['BEQ', 'BNE', 'BLT', 'BGE', 'JUMP']);

export function cycleHasControlFlow(cycle: CycleAst): boolean {
  if (cycle.label) return true;

  for (const statement of cycle.statements) {
    if (statement.kind === 'row') {
      if (statement.instructions.some((inst) => inst.opcode && CONTROL_FLOW_OPCODES.has(inst.opcode))) {
        return true;
      }
      continue;
    }

    if (statement.instruction.opcode && CONTROL_FLOW_OPCODES.has(statement.instruction.opcode)) {
      return true;
    }
  }
  return false;
}

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

export function cloneCycle(cycle: CycleAst, index: number): CycleAst {
  return {
    index,
    label: cycle.label,
    span: { ...cycle.span },
    statements: cycle.statements.map((statement) => {
      if (statement.kind === 'at') {
        return {
          kind: 'at' as const,
          row: statement.row,
          col: statement.col,
          instruction: {
            text: statement.instruction.text,
            opcode: statement.instruction.opcode,
            operands: [...statement.instruction.operands],
            span: { ...statement.instruction.span }
          },
          span: { ...statement.span }
        };
      }

      if (statement.kind === 'row') {
        return {
          kind: 'row' as const,
          row: statement.row,
          instructions: statement.instructions.map((instruction) => ({
            text: instruction.text,
            opcode: instruction.opcode,
            operands: [...instruction.operands],
            span: { ...instruction.span }
          })),
          span: { ...statement.span }
        };
      }

      if (statement.kind === 'col') {
        return {
          kind: 'col' as const,
          col: statement.col,
          instruction: {
            text: statement.instruction.text,
            opcode: statement.instruction.opcode,
            operands: [...statement.instruction.operands],
            span: { ...statement.instruction.span }
          },
          span: { ...statement.span }
        };
      }

      return {
        kind: 'all' as const,
        instruction: {
          text: statement.instruction.text,
          opcode: statement.instruction.opcode,
          operands: [...statement.instruction.operands],
          span: { ...statement.instruction.span }
        },
        span: { ...statement.span }
      };
    })
  };
}

function applyFunctionArgs(input: string, argsByParam: ReadonlyMap<string, string>): string {
  let out = input;
  for (const [name, value] of argsByParam.entries()) {
    const regex = new RegExp(`\\b${escapeRegExp(name)}\\b`, 'g');
    out = out.replace(regex, value);
  }
  return out;
}

export function instantiateFunctionBody(
  def: FunctionDefinitionLike,
  args: string[],
  callLineNo: number,
  diagnostics: Diagnostic[],
  expansionCounter: { value: number }
): SourceLineEntry[] | null {
  const argsByParam = bindFunctionCallArgs(def, args, callLineNo, diagnostics);
  if (!argsByParam) return null;

  const expansionId = expansionCounter.value++;
  const labelMap = new Map<string, string>();
  const labelPattern = /^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*cycle\b/i;
  for (const entry of def.body) {
    const match = entry.cleanLine.match(labelPattern);
    if (!match) continue;
    const original = match[1];
    if (!labelMap.has(original)) {
      labelMap.set(original, `__fn_${def.name}_${expansionId}_${original}`);
    }
  }

  return def.body.map((entry) => {
    let raw = applyFunctionArgs(entry.rawLine, argsByParam);
    let clean = applyFunctionArgs(entry.cleanLine, argsByParam);

    for (const [original, renamed] of labelMap.entries()) {
      const regex = new RegExp(`\\b${escapeRegExp(original)}\\b`, 'g');
      raw = raw.replace(regex, renamed);
      clean = clean.replace(regex, renamed);
    }

    return {
      lineNo: callLineNo,
      rawLine: raw,
      cleanLine: clean
    };
  });
}

export function makeControlCycle(
  index: number,
  lineNo: number,
  row: number,
  col: number,
  instructionText: string,
  label?: string
): CycleAst {
  const statementText = `@${row},${col}: ${instructionText};`;
  return {
    index,
    label,
    statements: [{
      kind: 'at',
      row,
      col,
      instruction: parseInstruction(instructionText, lineNo, 1),
      span: spanAt(lineNo, 1, statementText.length)
    }],
    span: spanAt(lineNo, 1, statementText.length)
  };
}
