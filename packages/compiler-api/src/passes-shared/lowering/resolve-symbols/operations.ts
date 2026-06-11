import { getInstructionSet } from '@castm/lang-spec';
import {
  Diagnostic,
  ErrorCodes,
  GridSpec,
  HirOperation,
  InstructionAst,
  CastmEditPolicy,
  CastmSlotOriginKind,
  CastmSlotSource,
  makeDiagnostic
} from '@castm/compiler-ir';
import { resolveLabelOperand } from './labels.js';

const VALID_OPCODES = new Set(getInstructionSet().map((x) => x.opcode));

export interface OperationSourceInput {
  originKind: CastmSlotOriginKind;
  editPolicy: CastmEditPolicy;
  originSpan: CastmSlotSource['originSpan'];
  humanAuthored?: boolean;
  astPath?: string;
  bundlePath?: string;
}

function buildSlotSource(
  bundleIndex: number,
  row: number,
  col: number,
  instruction: InstructionAst,
  source: OperationSourceInput | undefined
): CastmSlotSource {
  const stableBundleId = `bundle:${bundleIndex}`;
  const stableSlotId = `${stableBundleId}:@${row},${col}`;
  return {
    stableBundleId,
    stableSlotId,
    originKind: source?.originKind ?? 'direct',
    editPolicy: source?.editPolicy ?? 'direct-editable',
    originSpan: { ...(source?.originSpan ?? instruction.span) },
    instructionSpan: { ...instruction.span },
    humanAuthored: source?.humanAuthored ?? true,
    ...(source?.astPath ? { astPath: source.astPath } : {}),
    ...(source?.bundlePath ? { bundlePath: source.bundlePath } : {})
  };
}

export function addOperation(
  operations: HirOperation[],
  occupied: Set<string>,
  bundleIndex: number,
  row: number,
  col: number,
  instruction: InstructionAst,
  grid: GridSpec,
  labels: ReadonlyMap<string, number>,
  diagnostics: Diagnostic[],
  source?: OperationSourceInput
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

  const key = `${bundleIndex}:${row}:${col}`;
  if (occupied.has(key)) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Semantic.Collision,
      'error',
      instruction.span,
      `Multiple instructions target @${row},${col} in bundle ${bundleIndex}.`,
      'Split these writes into different bundles or coordinates.'
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
    span: { ...instruction.span },
    source: buildSlotSource(bundleIndex, row, col, instruction, source)
  });
}
