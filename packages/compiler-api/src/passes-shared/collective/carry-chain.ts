import {
  BundleAst,
  Diagnostic,
  ErrorCodes,
  GridSpec,
  SourceSpan,
  makeDiagnostic
} from '@castm/compiler-ir';
import { CarryChainAdvancedStatementArgs } from '../advanced-args.js';
import { createInstruction, createMultiAtBundle } from '../ast-utils.js';

function upperToken(value: string): string {
  return value.trim().toUpperCase();
}

function pushOutOfBounds(
  diagnostics: Diagnostic[],
  span: SourceSpan,
  message: string
): void {
  diagnostics.push(makeDiagnostic(
    ErrorCodes.Semantic.CoordinateOutOfBounds,
    'error',
    span,
    message,
    'Adjust row/start/dir/limbs to fit within the configured grid.'
  ));
}

export function buildCarryChainBundles(
  advancedStatement: CarryChainAdvancedStatementArgs,
  startIndex: number,
  grid: GridSpec,
  span: SourceSpan,
  diagnostics: Diagnostic[]
): BundleAst[] {
  if (advancedStatement.row < 0 || advancedStatement.row >= grid.rows) {
    pushOutOfBounds(
      diagnostics,
      span,
      `carry_chain row(${advancedStatement.row}) is outside grid rows [0, ${Math.max(0, grid.rows - 1)}].`
    );
    return [];
  }

  const srcReg = upperToken(advancedStatement.srcReg);
  const carryReg = upperToken(advancedStatement.carryReg);
  const storeSymbol = advancedStatement.storeSymbol.trim();

  const bundles: BundleAst[] = [];
  const delta = advancedStatement.direction === 'right' ? 1 : -1;

  for (let limb = 0; limb < advancedStatement.limbs; limb++) {
    const col = advancedStatement.startCol + limb * delta;
    if (col < 0 || col >= grid.cols) {
      pushOutOfBounds(
        diagnostics,
        span,
        `carry_chain limb ${limb} maps to column ${col}, outside grid cols [0, ${Math.max(0, grid.cols - 1)}].`
      );
      return [];
    }

    const baseIndex = startIndex + limb * 4;
    bundles.push(createMultiAtBundle(baseIndex, [{
      row: advancedStatement.row,
      col,
      instruction: createInstruction('SADD', [srcReg, srcReg, carryReg], span)
    }], span));
    bundles.push(createMultiAtBundle(baseIndex + 1, [{
      row: advancedStatement.row,
      col,
      instruction: createInstruction('LAND', [srcReg, srcReg, String(advancedStatement.mask)], span)
    }], span));
    bundles.push(createMultiAtBundle(baseIndex + 2, [{
      row: advancedStatement.row,
      col,
      instruction: createInstruction('SWI', [srcReg, `${storeSymbol}[${limb}]`], span)
    }], span));
    bundles.push(createMultiAtBundle(baseIndex + 3, [{
      row: advancedStatement.row,
      col,
      instruction: createInstruction('SRT', [carryReg, srcReg, String(advancedStatement.width)], span)
    }], span));
  }

  return bundles;
}
