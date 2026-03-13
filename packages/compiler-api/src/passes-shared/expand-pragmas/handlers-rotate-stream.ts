import {
  ErrorCodes,
  makeDiagnostic
} from '@castm/compiler-ir';
import {
  parseRotateShiftPragmaArgs,
  parseStreamLoadPragmaArgs,
  parseStreamStorePragmaArgs
} from '../advanced-args.js';
import {
  buildStreamCycles
} from '../collective-builders.js';
import {
  buildRotateShiftCycles
} from '../route-builders.js';
import { PragmaHandler } from './types.js';

export const handleRotateShift: PragmaHandler = (pragma, ctx) => {
  const pragmaName = pragma.text.trim().toLowerCase().startsWith('shift(') ? 'shift' : 'rotate';
  const parsed = parseRotateShiftPragmaArgs(pragma.text, pragmaName);
  if (!parsed) {
    ctx.diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      pragma.span,
      `Invalid ${pragmaName} statement syntax: '${pragma.text}'.`,
      pragmaName === 'rotate'
        ? 'Use rotate(reg=R0, direction=left|right, distance=1).'
        : 'Use shift(reg=R0, direction=left|right, distance=1, fill=0).'
    ));
    return;
  }

  const cycles = buildRotateShiftCycles(
    parsed,
    pragmaName === 'shift',
    ctx.generatedCycles.length,
    ctx.grid,
    pragma.span,
    ctx.diagnostics
  );
  ctx.generatedCycles.push(...cycles);
};

export const handleStreamLoad: PragmaHandler = (pragma, ctx) => {
  const parsed = parseStreamLoadPragmaArgs(pragma.text);
  if (!parsed) {
    ctx.diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      pragma.span,
      `Invalid stream_load statement syntax: '${pragma.text}'.`,
      'Use stream_load(dest=R0[, row=N][, count=N]).'
    ));
    return;
  }

  const cycles = buildStreamCycles(
    'LWD',
    parsed.destReg,
    parsed.row,
    parsed.count,
    ctx.generatedCycles.length,
    ctx.grid,
    pragma.span,
    ctx.diagnostics
  );
  ctx.generatedCycles.push(...cycles);
};

export const handleStreamStore: PragmaHandler = (pragma, ctx) => {
  const parsed = parseStreamStorePragmaArgs(pragma.text);
  if (!parsed) {
    ctx.diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      pragma.span,
      `Invalid stream_store statement syntax: '${pragma.text}'.`,
      'Use stream_store(src=R0[, row=N][, count=N]).'
    ));
    return;
  }

  const cycles = buildStreamCycles(
    'SWD',
    parsed.srcReg,
    parsed.row,
    parsed.count,
    ctx.generatedCycles.length,
    ctx.grid,
    pragma.span,
    ctx.diagnostics
  );
  ctx.generatedCycles.push(...cycles);
};
