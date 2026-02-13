import { CycleAst } from '@openedge/compiler-ir';
import { spanAt } from '@openedge/compiler-ir';
import { parseInstruction } from '../instructions.js';

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

      if (statement.kind === 'at-expr') {
        return {
          kind: 'at-expr' as const,
          rowExpr: statement.rowExpr,
          colExpr: statement.colExpr,
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
