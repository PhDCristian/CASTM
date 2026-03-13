import {
  CycleAst,
  Diagnostic,
  ErrorCodes,
  GridSpec,
  SourceSpan,
  makeDiagnostic
} from '@castm/compiler-ir';
import {
  createAtCycle,
  createInstruction
} from './ast-utils.js';
import { ReducePragmaArgs } from './advanced-args.js';
import { RoutePoint } from './route-args.js';
import { buildRouteTransferCycles } from './route-builders.js';
import {
  getReduceOpcode,
  pickScratchRegisters
} from './collective-scan-reduce-helpers.js';

export function buildReduceCycles(
  pragma: ReducePragmaArgs,
  startIndex: number,
  grid: GridSpec,
  span: SourceSpan,
  diagnostics: Diagnostic[]
): CycleAst[] {
  const compareOp = pragma.operation === 'max' || pragma.operation === 'min';
  const simpleOpcode = getReduceOpcode(pragma.operation);
  if (!compareOp && !simpleOpcode) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Semantic.UnsupportedOperation,
      'error',
      span,
      `Unsupported reduce operation '${pragma.operation}'.`,
      'Supported operations: sum, add, and, or, xor, mul, max, min.'
    ));
    return [];
  }

  const lanes = pragma.axis === 'row' ? grid.cols : grid.rows;
  if (lanes <= 0) {
    return [];
  }

  const scratch = pickScratchRegisters([pragma.srcReg, pragma.destReg]);
  if (!scratch) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Semantic.UnsupportedOperation,
      'error',
      span,
      `Could not allocate scratch registers for reduce destination '${pragma.destReg}'.`,
      'Use a target profile with temporary registers available.'
    ));
    return [];
  }

  const relayReg = scratch[0];
  const cmpReg = scratch[1];
  const anchor: RoutePoint = { row: 0, col: 0 };
  const sources: RoutePoint[] = [];
  for (let i = 1; i < lanes; i++) {
    sources.push(
      pragma.axis === 'row'
        ? { row: 0, col: i }
        : { row: i, col: 0 }
    );
  }
  sources.sort((a, b) => {
    const da = Math.abs(a.row - anchor.row) + Math.abs(a.col - anchor.col);
    const db = Math.abs(b.row - anchor.row) + Math.abs(b.col - anchor.col);
    if (da !== db) return da - db;
    if (a.row !== b.row) return a.row - b.row;
    return a.col - b.col;
  });

  const cycles: CycleAst[] = [];
  cycles.push(createAtCycle(
    startIndex + cycles.length,
    anchor.row,
    anchor.col,
    createInstruction('SADD', [pragma.destReg, pragma.srcReg, 'ZERO'], span),
    span
  ));

  for (const source of sources) {
    const transfer = buildRouteTransferCycles(
      source,
      anchor,
      pragma.srcReg,
      relayReg,
      startIndex + cycles.length,
      grid,
      span,
      diagnostics
    );
    cycles.push(...transfer);

    if (!compareOp && simpleOpcode) {
      cycles.push(createAtCycle(
        startIndex + cycles.length,
        anchor.row,
        anchor.col,
        createInstruction(simpleOpcode, [pragma.destReg, pragma.destReg, relayReg], span),
        span
      ));
      continue;
    }

    cycles.push(createAtCycle(
      startIndex + cycles.length,
      anchor.row,
      anchor.col,
      createInstruction('SSUB', [cmpReg, pragma.destReg, relayReg], span),
      span
    ));

    const first = pragma.operation === 'max' ? relayReg : pragma.destReg;
    const second = pragma.operation === 'max' ? pragma.destReg : relayReg;
    cycles.push(createAtCycle(
      startIndex + cycles.length,
      anchor.row,
      anchor.col,
      createInstruction('BSFA', [pragma.destReg, first, second, 'SELF'], span),
      span
    ));
  }

  return cycles;
}
