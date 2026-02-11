import {
  AstProgram,
  Diagnostic,
  ErrorCodes,
  makeDiagnostic,
  ParseResult,
  spanAt,
  StructuredProgramAst
} from '@openedge/compiler-ir';
import { lowerStructuredProgramToAst, toStructuredProgramAst } from './structured-core/conversion.js';
import { parseStructuredProgramFromSource } from './structured-core/parse-source.js';

export {
  lowerStructuredProgramToAst,
  parseStructuredProgramFromSource,
  toStructuredProgramAst
};

export interface StructuredParseResult extends ParseResult {
  structuredAst?: StructuredProgramAst;
  ast?: AstProgram;
  diagnostics: Diagnostic[];
}

function validateStructuredMinimum(structuredAst: StructuredProgramAst): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  if (!structuredAst.targetProfileId) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.MissingTarget,
      'error',
      spanAt(1, 1, 1),
      'Missing required target declaration.',
      'Add: target "uma-cgra-base";'
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

export function parseStructuredSource(source: string): StructuredParseResult {
  const parsed = parseStructuredProgramFromSource(source);
  const structuredAst = parsed.program;
  const diagnostics = [...parsed.diagnostics, ...validateStructuredMinimum(structuredAst)];
  const hasErrors = diagnostics.some((d) => d.severity === 'error');

  return {
    success: !hasErrors,
    ast: hasErrors ? undefined : lowerStructuredProgramToAst(structuredAst),
    diagnostics,
    structuredAst,
  };
}
