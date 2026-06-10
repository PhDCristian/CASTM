import {
  BundleAst,
  Diagnostic,
  ErrorCodes,
  GridSpec,
  SourceSpan,
  makeDiagnostic
} from '@castm/compiler-ir';
import {
  createAtBundle,
  createInstruction
} from './ast-utils.js';
import { computeRoutePath, getIncomingRegister } from './grid-utils.js';
import { RoutePoint } from './route-args.js';

export function buildRouteTransferBundles(
  src: RoutePoint,
  dst: RoutePoint,
  payloadReg: string,
  destReg: string,
  startIndex: number,
  grid: GridSpec,
  span: SourceSpan,
  diagnostics: Diagnostic[]
): BundleAst[] {
  const path = computeRoutePath(src, dst, grid);
  const bundles: BundleAst[] = [];
  if (path.length === 0) return bundles;

  if (path.length === 1) {
    bundles.push(createAtBundle(
      startIndex,
      src.row,
      src.col,
      createInstruction('SADD', [destReg, payloadReg, 'ZERO'], span),
      span
    ));
    return bundles;
  }

  for (let i = 0; i < path.length; i++) {
    const point = path[i];
    const isFirst = i === 0;
    const isLast = i === path.length - 1;

    if (isFirst) {
      bundles.push(createAtBundle(
        startIndex + i,
        point.row,
        point.col,
        createInstruction('SADD', ['ROUT', payloadReg, 'ZERO'], span),
        span
      ));
      continue;
    }

    const incoming = getIncomingRegister(path[i - 1], point, grid);
    if (!incoming) {
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Internal.UnexpectedState,
        'error',
        span,
        `Could not resolve transfer direction for step (${path[i - 1].row},${path[i - 1].col}) -> (${point.row},${point.col}).`
      ));
      continue;
    }

    if (!isLast) {
      bundles.push(createAtBundle(
        startIndex + i,
        point.row,
        point.col,
        createInstruction('SADD', ['ROUT', incoming, 'ZERO'], span),
        span
      ));
      continue;
    }

    bundles.push(createAtBundle(
      startIndex + i,
      point.row,
      point.col,
      createInstruction('SADD', [destReg, incoming, 'ZERO'], span),
      span
    ));
  }

  return bundles;
}
