import { getInstructionSet } from '@castm/lang-spec';
import {
  Diagnostic,
  ErrorCodes,
  GridSpec,
  HirOperation,
  InstructionAst,
  makeDiagnostic
} from '@castm/compiler-ir';
import { resolveLabelOperand } from './labels.js';

const VALID_OPCODES = new Set(getInstructionSet().map((x) => x.opcode));

export function addOperation(
  operations: HirOperation[],
  occupied: Set<string>,
  cycleIndex: number,
  row: number,
  col: number,
  instruction: InstructionAst,
  grid: GridSpec,
  labels: ReadonlyMap<string, number>,
  diagnostics: Diagnostic[]
): void {
  if (row < 0 || row >= grid.rows || col < 0 || col >= grid.cols) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Semantic.CoordinateOutOfBounds,
      'error',
      instruction.span,
      `Coordinate @${row},${col} is out of bounds for ${grid.rows}x${grid.cols}.`,
      'Adjust the coordinate or change grid size in CompileOptions.'
    ));
    return;
  }

  const key = `${cycleIndex}:${row}:${col}`;
  if (occupied.has(key)) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Semantic.Collision,
      'error',
      instruction.span,
      `Multiple instructions target @${row},${col} in cycle ${cycleIndex}.`,
      'Split these writes into different cycles or coordinates.'
    ));
    return;
  }

  if (!instruction.opcode) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Semantic.InvalidAssignment,
      'error',
      instruction.span,
      `Could not lower instruction '${instruction.text}'.`,
      'Only ISA instructions or supported assignment sugars can be compiled.'
    ));
    return;
  }

  const opcode = instruction.opcode.toUpperCase();
  if (!VALID_OPCODES.has(opcode)) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Semantic.UnknownOpcode,
      'error',
      instruction.span,
      `Unknown opcode '${instruction.opcode}'.`,
      'Check the instruction set catalog in @castm/lang-spec.'
    ));
    return;
  }

  occupied.add(key);
  const resolvedOperands = resolveLabelOperand(opcode, instruction.operands, labels, instruction.span, diagnostics);
  operations.push({
    row,
    col,
    opcode,
    operands: resolvedOperands,
    span: { ...instruction.span }
  });
}
