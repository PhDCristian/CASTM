import {
  AstProgram,
  Diagnostic,
  ErrorCodes,
  makeDiagnostic
} from '@castm/compiler-ir';
import { SemanticPassResult } from './types.js';

function validateUniqueDirectiveNames(ast: AstProgram, diagnostics: Diagnostic[]): void {
  const seen = new Map<string, string>();
  for (const directive of ast.kernel?.directives ?? []) {
    const key = directive.name;
    if (!seen.has(key)) {
      seen.set(key, directive.kind);
      continue;
    }

    const previousKind = seen.get(key);
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Semantic.UnsupportedOperation,
      'error',
      directive.span,
      `Duplicate symbol '${directive.name}' across declarations.`,
      `First declaration kind was '${previousKind}'. Use unique names for constants, aliases, and data regions.`
    ));
  }
}

export function runSemanticChecker(ast: AstProgram, diagnostics: Diagnostic[]): SemanticPassResult {
  const localDiagnostics: Diagnostic[] = [];
  validateUniqueDirectiveNames(ast, localDiagnostics);

  diagnostics.push(...localDiagnostics);
  return {
    ast,
    diagnostics,
    loweredPasses: ['semantic-checker']
  };
}
