import {
  CycleAst,
  Diagnostic,
  GridSpec,
  SourceSpan
} from '@castm/compiler-ir';
import { AllreducePragmaArgs } from '../advanced-args.js';
import { buildBroadcastCycles } from '../route-builders.js';
import { buildReduceCycles } from '../collective-scan-reduce.js';

export function buildAllreduceCycles(
  pragma: AllreducePragmaArgs,
  startIndex: number,
  grid: GridSpec,
  span: SourceSpan,
  diagnostics: Diagnostic[]
): CycleAst[] {
  const reduceBefore = diagnostics.length;
  const reduceCycles = buildReduceCycles(
    {
      operation: pragma.operation,
      destReg: pragma.destReg,
      srcReg: pragma.srcReg,
      axis: pragma.axis
    },
    startIndex,
    grid,
    span,
    diagnostics
  );

  if (diagnostics.length > reduceBefore && reduceCycles.length === 0) {
    return [];
  }

  const broadcastCycles = buildBroadcastCycles(
    {
      valueReg: pragma.destReg,
      from: { row: 0, col: 0 },
      scope: pragma.axis === 'col' ? 'column' : 'row'
    },
    startIndex + reduceCycles.length,
    grid,
    span,
    diagnostics
  );

  return [...reduceCycles, ...broadcastCycles];
}
