import {
  BundleAst,
  Diagnostic,
  ErrorCodes,
  GridSpec,
  InstructionAst,
  SourceSpan,
  makeDiagnostic
} from '@castm/compiler-ir';
import {
  createInstruction,
  createMultiAtBundle
} from './ast-utils.js';
import { ScanAdvancedStatementArgs } from './advanced-args.js';
import {
  getScanIdentity,
  getScanIncomingRegister,
  getScanOpcode
} from './collective-scan-reduce-helpers.js';

export function buildScanBundles(
  advancedStatement: ScanAdvancedStatementArgs,
  startIndex: number,
  grid: GridSpec,
  span: SourceSpan,
  diagnostics: Diagnostic[]
): BundleAst[] {
  const compareOp = advancedStatement.operation === 'max' || advancedStatement.operation === 'min';
  const simpleOpcode = getScanOpcode(advancedStatement.operation);
  if (!compareOp && !simpleOpcode) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Semantic.UnsupportedOperation,
      'error',
      span,
      `Unsupported scan operation '${advancedStatement.operation}'.`,
      'Supported operations: add, and, or, xor, max, min.'
    ));
    return [];
  }

  const horizontal = advancedStatement.direction === 'left' || advancedStatement.direction === 'right';
  const lineCount = horizontal ? grid.rows : grid.cols;
  const laneLength = horizontal ? grid.cols : grid.rows;
  if (laneLength <= 0 || lineCount <= 0) {
    return [];
  }

  const forward = advancedStatement.direction === 'right' || advancedStatement.direction === 'down';
  const incoming = getScanIncomingRegister(advancedStatement.direction);
  const identity = getScanIdentity(advancedStatement.operation);
  const bsfaFirst = advancedStatement.operation === 'max' ? incoming : advancedStatement.dstReg;
  const bsfaSecond = advancedStatement.operation === 'max' ? advancedStatement.dstReg : incoming;

  const bundles: BundleAst[] = [];

  for (let i = 0; i < laneLength; i++) {
    const laneIndex = forward ? i : laneLength - 1 - i;
    const first = i === 0;
    const stagePlacements: Array<{ row: number; col: number; instruction: InstructionAst }> = [];

    for (let line = 0; line < lineCount; line++) {
      const row = horizontal ? line : laneIndex;
      const col = horizontal ? laneIndex : line;

      if (first) {
        if (advancedStatement.mode === 'inclusive') {
          stagePlacements.push({
            row,
            col,
            instruction: createInstruction('SADD', [advancedStatement.dstReg, advancedStatement.srcReg, 'ZERO'], span)
          });
        } else {
          stagePlacements.push({
            row,
            col,
            instruction: createInstruction('SADD', [advancedStatement.dstReg, 'ZERO', String(identity)], span)
          });
        }
        continue;
      }

      if (!compareOp && simpleOpcode) {
        stagePlacements.push({
          row,
          col,
          instruction: createInstruction(simpleOpcode, [advancedStatement.dstReg, advancedStatement.dstReg, incoming], span)
        });
        continue;
      }

      stagePlacements.push({
        row,
        col,
        instruction: createInstruction('SSUB', ['R2', advancedStatement.dstReg, incoming], span)
      });
    }

    if (first) {
      bundles.push(createMultiAtBundle(startIndex + bundles.length, stagePlacements, span));
    } else if (!compareOp && simpleOpcode) {
      bundles.push(createMultiAtBundle(startIndex + bundles.length, stagePlacements, span));
    } else {
      bundles.push(createMultiAtBundle(startIndex + bundles.length, stagePlacements, span));

      const selectPlacements: Array<{ row: number; col: number; instruction: InstructionAst }> = [];
      for (let line = 0; line < lineCount; line++) {
        const row = horizontal ? line : laneIndex;
        const col = horizontal ? laneIndex : line;
        selectPlacements.push({
          row,
          col,
          instruction: createInstruction('BSFA', [advancedStatement.dstReg, bsfaFirst, bsfaSecond, 'SELF'], span)
        });
      }
      bundles.push(createMultiAtBundle(startIndex + bundles.length, selectPlacements, span));
    }

    if (i < laneLength - 1) {
      const relaySource = first && advancedStatement.mode === 'exclusive'
        ? advancedStatement.srcReg
        : advancedStatement.dstReg;
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
      bundles.push(createMultiAtBundle(startIndex + bundles.length, relayPlacements, span));
    }
  }

  return bundles;
}
