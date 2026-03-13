import {
  CycleAst,
  Diagnostic,
  ErrorCodes,
  GridSpec,
  InstructionAst,
  SourceSpan,
  makeDiagnostic
} from '@castm/compiler-ir';
import {
  createInstruction,
  createMultiAtCycle
} from './ast-utils.js';
import { ScanPragmaArgs } from './advanced-args.js';
import {
  getScanIdentity,
  getScanIncomingRegister,
  getScanOpcode
} from './collective-scan-reduce-helpers.js';

export function buildScanCycles(
  pragma: ScanPragmaArgs,
  startIndex: number,
  grid: GridSpec,
  span: SourceSpan,
  diagnostics: Diagnostic[]
): CycleAst[] {
  const compareOp = pragma.operation === 'max' || pragma.operation === 'min';
  const simpleOpcode = getScanOpcode(pragma.operation);
  if (!compareOp && !simpleOpcode) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Semantic.UnsupportedOperation,
      'error',
      span,
      `Unsupported scan operation '${pragma.operation}'.`,
      'Supported operations: add, and, or, xor, max, min.'
    ));
    return [];
  }

  const horizontal = pragma.direction === 'left' || pragma.direction === 'right';
  const lineCount = horizontal ? grid.rows : grid.cols;
  const laneLength = horizontal ? grid.cols : grid.rows;
  if (laneLength <= 0 || lineCount <= 0) {
    return [];
  }

  const forward = pragma.direction === 'right' || pragma.direction === 'down';
  const incoming = getScanIncomingRegister(pragma.direction);
  const identity = getScanIdentity(pragma.operation);
  const bsfaFirst = pragma.operation === 'max' ? incoming : pragma.dstReg;
  const bsfaSecond = pragma.operation === 'max' ? pragma.dstReg : incoming;

  const cycles: CycleAst[] = [];

  for (let i = 0; i < laneLength; i++) {
    const laneIndex = forward ? i : laneLength - 1 - i;
    const first = i === 0;
    const stagePlacements: Array<{ row: number; col: number; instruction: InstructionAst }> = [];

    for (let line = 0; line < lineCount; line++) {
      const row = horizontal ? line : laneIndex;
      const col = horizontal ? laneIndex : line;

      if (first) {
        if (pragma.mode === 'inclusive') {
          stagePlacements.push({
            row,
            col,
            instruction: createInstruction('SADD', [pragma.dstReg, pragma.srcReg, 'ZERO'], span)
          });
        } else {
          stagePlacements.push({
            row,
            col,
            instruction: createInstruction('SADD', [pragma.dstReg, 'ZERO', String(identity)], span)
          });
        }
        continue;
      }

      if (!compareOp && simpleOpcode) {
        stagePlacements.push({
          row,
          col,
          instruction: createInstruction(simpleOpcode, [pragma.dstReg, pragma.dstReg, incoming], span)
        });
        continue;
      }

      stagePlacements.push({
        row,
        col,
        instruction: createInstruction('SSUB', ['R2', pragma.dstReg, incoming], span)
      });
    }

    if (first) {
      cycles.push(createMultiAtCycle(startIndex + cycles.length, stagePlacements, span));
    } else if (!compareOp && simpleOpcode) {
      cycles.push(createMultiAtCycle(startIndex + cycles.length, stagePlacements, span));
    } else {
      cycles.push(createMultiAtCycle(startIndex + cycles.length, stagePlacements, span));

      const selectPlacements: Array<{ row: number; col: number; instruction: InstructionAst }> = [];
      for (let line = 0; line < lineCount; line++) {
        const row = horizontal ? line : laneIndex;
        const col = horizontal ? laneIndex : line;
        selectPlacements.push({
          row,
          col,
          instruction: createInstruction('BSFA', [pragma.dstReg, bsfaFirst, bsfaSecond, 'SELF'], span)
        });
      }
      cycles.push(createMultiAtCycle(startIndex + cycles.length, selectPlacements, span));
    }

    if (i < laneLength - 1) {
      const relaySource = first && pragma.mode === 'exclusive'
        ? pragma.srcReg
        : pragma.dstReg;
      const relayPlacements: Array<{ row: number; col: number; instruction: InstructionAst }> = [];
      for (let line = 0; line < lineCount; line++) {
        const row = horizontal ? line : laneIndex;
        const col = horizontal ? laneIndex : line;
        relayPlacements.push({
          row,
          col,
          instruction: createInstruction('SADD', ['ROUT', relaySource, 'ZERO'], span)
        });
      }
      cycles.push(createMultiAtCycle(startIndex + cycles.length, relayPlacements, span));
    }
  }

  return cycles;
}
