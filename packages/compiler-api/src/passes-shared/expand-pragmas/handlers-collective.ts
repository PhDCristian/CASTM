import {
  ErrorCodes,
  makeDiagnostic
} from '@openedge/compiler-ir';
import {
  parseAllreducePragmaArgs,
  parseGatherPragmaArgs,
  parseReducePragmaArgs,
  parseScanPragmaArgs,
  parseStencilPragmaArgs,
  parseTransposePragmaArgs
} from '../advanced-args.js';
import {
  buildAllreduceCycles,
  buildGatherCycles,
  buildReduceCycles,
  buildScanCycles,
  buildStencilCycles,
  buildTransposeCycles
} from '../collective-builders.js';
import { PragmaHandler } from './types.js';

export const handleScan: PragmaHandler = (pragma, ctx) => {
  const parsed = parseScanPragmaArgs(pragma.text);
  if (!parsed) {
    ctx.diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      pragma.span,
      `Invalid scan statement syntax: '${pragma.text}'.`,
      'Use scan(op=add, src=R0, dest=R1, dir=left|right|up|down[, mode=inclusive|exclusive]).'
    ));
    return;
  }

  const cycles = buildScanCycles(
    parsed,
    ctx.generatedCycles.length,
    ctx.grid,
    pragma.span,
    ctx.diagnostics
  );
  ctx.generatedCycles.push(...cycles);
};

export const handleReduce: PragmaHandler = (pragma, ctx) => {
  const parsed = parseReducePragmaArgs(pragma.text);
  if (!parsed) {
    ctx.diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      pragma.span,
      `Invalid reduce statement syntax: '${pragma.text}'.`,
      'Use reduce(op=add|sum|and|or, dest=R1, src=R0[, axis=row|col]).'
    ));
    return;
  }

  const cycles = buildReduceCycles(
    parsed,
    ctx.generatedCycles.length,
    ctx.grid,
    pragma.span,
    ctx.diagnostics
  );
  ctx.generatedCycles.push(...cycles);
};

export const handleStencil: PragmaHandler = (pragma, ctx) => {
  const parsed = parseStencilPragmaArgs(pragma.text);
  if (!parsed) {
    ctx.diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      pragma.span,
      `Invalid stencil statement syntax: '${pragma.text}'.`,
      'Use stencil(pattern, srcReg, destReg) or stencil(pattern, operation, srcReg, destReg).'
    ));
    return;
  }

  const cycles = buildStencilCycles(
    parsed,
    ctx.generatedCycles.length,
    ctx.grid,
    pragma.span,
    ctx.diagnostics
  );
  ctx.generatedCycles.push(...cycles);
};

export const handleAllreduce: PragmaHandler = (pragma, ctx) => {
  const parsed = parseAllreducePragmaArgs(pragma.text);
  if (!parsed) {
    ctx.diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      pragma.span,
      `Invalid allreduce statement syntax: '${pragma.text}'.`,
      'Use allreduce(op=add|sum|and|or, dest=R1, src=R0[, axis=row|col]).'
    ));
    return;
  }

  const cycles = buildAllreduceCycles(
    parsed,
    ctx.generatedCycles.length,
    ctx.grid,
    pragma.span,
    ctx.diagnostics
  );
  ctx.generatedCycles.push(...cycles);
};

export const handleTranspose: PragmaHandler = (pragma, ctx) => {
  const parsed = parseTransposePragmaArgs(pragma.text);
  if (!parsed) {
    ctx.diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      pragma.span,
      `Invalid transpose statement syntax: '${pragma.text}'.`,
      'Use transpose(reg=R0).'
    ));
    return;
  }

  const cycles = buildTransposeCycles(
    parsed,
    ctx.generatedCycles.length,
    ctx.grid,
    pragma.span,
    ctx.diagnostics
  );
  ctx.generatedCycles.push(...cycles);
};

export const handleGather: PragmaHandler = (pragma, ctx) => {
  const parsed = parseGatherPragmaArgs(pragma.text);
  if (!parsed) {
    ctx.diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      pragma.span,
      `Invalid gather statement syntax: '${pragma.text}'.`,
      'Use gather(src=R0, dest=@row,col, destReg=R1, op=add).'
    ));
    return;
  }

  const cycles = buildGatherCycles(
    parsed,
    ctx.generatedCycles.length,
    ctx.grid,
    pragma.span,
    ctx.diagnostics
  );
  ctx.generatedCycles.push(...cycles);
};
