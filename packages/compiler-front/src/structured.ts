import {
  AstProgram,
  CompileOptions,
  Diagnostic,
  ErrorCodes,
  makeDiagnostic,
  ParseResult,
  spanAt,
  StructuredProgramAst
} from '@castm/compiler-ir';
import {
  lowerStructuredProgramToAst,
  lowerStructuredProgramToAstDetailed,
  toStructuredProgramAst
} from './structured-core/conversion.js';
import {
  parseStructuredProgramFromSource,
  preprocessIncludes
} from './structured-core/parse-source.js';

export {
  lowerStructuredProgramToAst,
  lowerStructuredProgramToAstDetailed,
  parseStructuredProgramFromSource,
  preprocessIncludes,
  toStructuredProgramAst
};

export interface StructuredParseResult extends ParseResult {
  structuredAst?: StructuredProgramAst;
  ast?: AstProgram;
  diagnostics: Diagnostic[];
}

function validateStructuredMinimum(structuredAst: StructuredProgramAst): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  if (!structuredAst.targetProfileId || !structuredAst.target) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.MissingTarget,
      'error',
      spanAt(1, 1, 1),
      'Missing required target declaration.',
      'Add: target base;'
    ));
  }
  if (!structuredAst.kernel) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.MissingKernel,
      'error',
      spanAt(1, 1, 1),
      'Missing kernel declaration.',
      'Add: kernel "Name" { ... }'
    ));
  }
  return diagnostics;
}

export function parseStructuredSource(source: string, options: CompileOptions = {}): StructuredParseResult {
  let processedSource = source;
  const includeDiagnostics: Diagnostic[] = [];
  if (options.resolveInclude) {
    processedSource = preprocessIncludes(source, options.resolveInclude, includeDiagnostics);
  }
  const parsed = parseStructuredProgramFromSource(processedSource);
  const structuredAst = parsed.program;
  const baseDiagnostics = [...includeDiagnostics, ...parsed.diagnostics, ...validateStructuredMinimum(structuredAst)];
  const hasBaseErrors = baseDiagnostics.some((d) => d.severity === 'error');

  if (hasBaseErrors) {
    return {
      success: false,
      ast: undefined,
      diagnostics: baseDiagnostics,
      structuredAst,
    };
  }

  const lowered = lowerStructuredProgramToAstDetailed(structuredAst, {
    expansionMode: options.expansionMode
  });
  const diagnostics = [...baseDiagnostics, ...lowered.diagnostics];
  const hasErrors = diagnostics.some((d) => d.severity === 'error');

  return {
    success: !hasErrors,
    ast: hasErrors ? undefined : lowered.ast,
    diagnostics,
    structuredAst,
  };
}
