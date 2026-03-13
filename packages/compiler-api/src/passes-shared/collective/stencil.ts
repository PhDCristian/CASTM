import {
  CycleAst,
  Diagnostic,
  ErrorCodes,
  GridSpec,
  SourceSpan,
  makeDiagnostic
} from '@castm/compiler-ir';
import {
  createInstruction,
  createMultiAtCycle
} from '../ast-utils.js';
import { StencilPragmaArgs } from '../advanced-args.js';

export function buildStencilCycles(
  pragma: StencilPragmaArgs,
  startIndex: number,
  grid: GridSpec,
  span: SourceSpan,
  diagnostics: Diagnostic[]
): CycleAst[] {
  if (grid.cols <= 0) {
    return [];
  }

  if (!['sum', 'add', 'avg'].includes(pragma.operation)) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Semantic.UnsupportedOperation,
      'error',
      span,
      `Unsupported stencil operation '${pragma.operation}'.`,
      'Supported operations: sum, add, avg.'
    ));
    return [];
  }

  const makeUniformRowCycle = (
    cycleIndex: number,
    dest: string,
    srcA: string,
    srcB: string
  ): CycleAst => createMultiAtCycle(
    cycleIndex,
    Array.from({ length: grid.rows * grid.cols }, (_, idx) => {
      const row = Math.floor(idx / grid.cols);
      const col = idx % grid.cols;
      return {
        row,
        col,
        instruction: createInstruction('SADD', [dest, srcA, srcB], span)
      };
    }),
    span
  );

  const cycles: CycleAst[] = [];

  if (pragma.pattern === 'cross') {
    cycles.push(makeUniformRowCycle(startIndex + cycles.length, 'R2', pragma.srcReg, 'RCT'));
    cycles.push(makeUniformRowCycle(startIndex + cycles.length, 'R2', 'R2', 'RCB'));
    cycles.push(makeUniformRowCycle(startIndex + cycles.length, 'R2', 'R2', 'RCL'));
    cycles.push(makeUniformRowCycle(startIndex + cycles.length, pragma.destReg, 'R2', 'RCR'));
    return cycles;
  }

  if (pragma.pattern === 'horizontal') {
    cycles.push(makeUniformRowCycle(startIndex + cycles.length, 'R2', pragma.srcReg, 'RCL'));
    cycles.push(makeUniformRowCycle(startIndex + cycles.length, pragma.destReg, 'R2', 'RCR'));
    return cycles;
  }

  cycles.push(makeUniformRowCycle(startIndex + cycles.length, 'R2', pragma.srcReg, 'RCT'));
  cycles.push(makeUniformRowCycle(startIndex + cycles.length, pragma.destReg, 'R2', 'RCB'));
  return cycles;
}
