import {
  BundleAst,
  Diagnostic,
  ErrorCodes,
  GridSpec,
  SourceSpan,
  makeDiagnostic
} from '@castm/compiler-ir';
import {
  createInstruction,
  createMultiAtBundle
} from '../ast-utils.js';
import { StencilAdvancedStatementArgs } from '../advanced-args.js';

export function buildStencilBundles(
  advancedStatement: StencilAdvancedStatementArgs,
  startIndex: number,
  grid: GridSpec,
  span: SourceSpan,
  diagnostics: Diagnostic[]
): BundleAst[] {
  if (grid.cols <= 0) {
    return [];
  }

  if (!['sum', 'add', 'avg'].includes(advancedStatement.operation)) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Semantic.UnsupportedOperation,
      'error',
      span,
      `Unsupported stencil operation '${advancedStatement.operation}'.`,
      'Supported operations: sum, add, avg.'
    ));
    return [];
  }

  const makeUniformRowBundle = (
    bundleIndex: number,
    dest: string,
    srcA: string,
    srcB: string
  ): BundleAst => createMultiAtBundle(
    bundleIndex,
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

  const bundles: BundleAst[] = [];

  if (advancedStatement.pattern === 'cross') {
    bundles.push(makeUniformRowBundle(startIndex + bundles.length, 'R2', advancedStatement.srcReg, 'RCT'));
    bundles.push(makeUniformRowBundle(startIndex + bundles.length, 'R2', 'R2', 'RCB'));
    bundles.push(makeUniformRowBundle(startIndex + bundles.length, 'R2', 'R2', 'RCL'));
    bundles.push(makeUniformRowBundle(startIndex + bundles.length, advancedStatement.destReg, 'R2', 'RCR'));
    return bundles;
  }

  if (advancedStatement.pattern === 'horizontal') {
    bundles.push(makeUniformRowBundle(startIndex + bundles.length, 'R2', advancedStatement.srcReg, 'RCL'));
    bundles.push(makeUniformRowBundle(startIndex + bundles.length, advancedStatement.destReg, 'R2', 'RCR'));
    return bundles;
  }

  bundles.push(makeUniformRowBundle(startIndex + bundles.length, 'R2', advancedStatement.srcReg, 'RCT'));
  bundles.push(makeUniformRowBundle(startIndex + bundles.length, advancedStatement.destReg, 'R2', 'RCB'));
  return bundles;
}
