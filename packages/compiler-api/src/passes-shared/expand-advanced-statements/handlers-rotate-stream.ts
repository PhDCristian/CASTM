import {
  ErrorCodes,
  makeDiagnostic
} from '@castm/compiler-ir';
import {
  parseRotateShiftAdvancedStatementArgs,
  parseStreamLoadAdvancedStatementArgs,
  parseStreamStoreAdvancedStatementArgs
} from '../advanced-args.js';
import {
  buildStreamBundles
} from '../collective-builders.js';
import {
  buildRotateShiftBundles
} from '../route-builders.js';
import { AdvancedStatementHandler } from './types.js';

export const handleRotateShift: AdvancedStatementHandler = (advancedStatement, ctx) => {
  const advancedStatementName = advancedStatement.text.trim().toLowerCase().startsWith('shift(') ? 'shift' : 'rotate';
  const parsed = parseRotateShiftAdvancedStatementArgs(advancedStatement.text, advancedStatementName);
  if (!parsed) {
    ctx.diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      advancedStatement.span,
      `Invalid ${advancedStatementName} statement syntax: '${advancedStatement.text}'.`,
      advancedStatementName === 'rotate'
        ? 'Use rotate(reg=R0, direction=left|right, distance=1).'
        : 'Use shift(reg=R0, direction=left|right, distance=1, fill=0).'
    ));
    return;
  }

  const bundles = buildRotateShiftBundles(
    parsed,
    advancedStatementName === 'shift',
    ctx.generatedBundles.length,
    ctx.grid,
    advancedStatement.span,
    ctx.diagnostics
  );
  ctx.generatedBundles.push(...bundles);
};

export const handleStreamLoad: AdvancedStatementHandler = (advancedStatement, ctx) => {
  const parsed = parseStreamLoadAdvancedStatementArgs(advancedStatement.text);
  if (!parsed) {
    ctx.diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      advancedStatement.span,
      `Invalid stream_load statement syntax: '${advancedStatement.text}'.`,
      'Use stream_load(dest=R0[, row=N][, count=N]).'
    ));
    return;
  }

  const bundles = buildStreamBundles(
    'LWD',
    parsed.destReg,
    parsed.row,
    parsed.count,
    ctx.generatedBundles.length,
    ctx.grid,
    advancedStatement.span,
    ctx.diagnostics
  );
  ctx.generatedBundles.push(...bundles);
};

export const handleStreamStore: AdvancedStatementHandler = (advancedStatement, ctx) => {
  const parsed = parseStreamStoreAdvancedStatementArgs(advancedStatement.text);
  if (!parsed) {
    ctx.diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      advancedStatement.span,
      `Invalid stream_store statement syntax: '${advancedStatement.text}'.`,
      'Use stream_store(src=R0[, row=N][, count=N]).'
    ));
    return;
  }

  const bundles = buildStreamBundles(
    'SWD',
    parsed.srcReg,
    parsed.row,
    parsed.count,
    ctx.generatedBundles.length,
    ctx.grid,
    advancedStatement.span,
    ctx.diagnostics
  );
  ctx.generatedBundles.push(...bundles);
};
