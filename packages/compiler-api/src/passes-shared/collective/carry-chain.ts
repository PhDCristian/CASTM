import {
  CycleAst,
  Diagnostic,
  ErrorCodes,
  GridSpec,
  SourceSpan,
  makeDiagnostic
} from '@castm/compiler-ir';
import { CarryChainPragmaArgs } from '../advanced-args.js';
import { createInstruction, createMultiAtCycle } from '../ast-utils.js';

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

export function buildCarryChainCycles(
  pragma: CarryChainPragmaArgs,
  startIndex: number,
  grid: GridSpec,
  span: SourceSpan,
  diagnostics: Diagnostic[]
): CycleAst[] {
  if (pragma.row < 0 || pragma.row >= grid.rows) {
    pushOutOfBounds(
      diagnostics,
      span,
      `carry_chain row(${pragma.row}) is outside grid rows [0, ${Math.max(0, grid.rows - 1)}].`
    );
    return [];
  }

  const srcReg = upperToken(pragma.srcReg);
  const carryReg = upperToken(pragma.carryReg);
  const storeSymbol = pragma.storeSymbol.trim();

  const cycles: CycleAst[] = [];
  const delta = pragma.direction === 'right' ? 1 : -1;

  for (let limb = 0; limb < pragma.limbs; limb++) {
    const col = pragma.startCol + limb * delta;
    if (col < 0 || col >= grid.cols) {
      pushOutOfBounds(
        diagnostics,
        span,
        `carry_chain limb ${limb} maps to column ${col}, outside grid cols [0, ${Math.max(0, grid.cols - 1)}].`
      );
      return [];
    }

    const baseIndex = startIndex + limb * 4;
    cycles.push(createMultiAtCycle(baseIndex, [{
      row: pragma.row,
      col,
      instruction: createInstruction('SADD', [srcReg, srcReg, carryReg], span)
    }], span));
    cycles.push(createMultiAtCycle(baseIndex + 1, [{
      row: pragma.row,
      col,
      instruction: createInstruction('LAND', [srcReg, srcReg, String(pragma.mask)], span)
    }], span));
    cycles.push(createMultiAtCycle(baseIndex + 2, [{
      row: pragma.row,
      col,
      instruction: createInstruction('SWI', [srcReg, `${storeSymbol}[${limb}]`], span)
    }], span));
    cycles.push(createMultiAtCycle(baseIndex + 3, [{
      row: pragma.row,
      col,
      instruction: createInstruction('SRT', [carryReg, srcReg, String(pragma.width)], span)
    }], span));
  }

  return cycles;
}
