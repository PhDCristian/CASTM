import { Diagnostic, DirectiveAst, ErrorCodes, makeDiagnostic } from '@castm/compiler-ir';
import { evaluateNumericExpression } from '../../parser-utils/numbers.js';

export function buildConstantMap(directives: DirectiveAst[], diagnostics: Diagnostic[]): Map<string, number> {
  const constants = new Map<string, number>();

  for (const directive of directives) {
    if (directive.kind !== 'const') continue;
    const value = evaluateNumericExpression(directive.value, constants, new Map());
    if (value === null) {
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Parse.InvalidSyntax,
        'error',
        directive.span,
        `Invalid numeric value for constant '${directive.name}': '${directive.value}'.`,
        'Use integer expressions referencing previously declared constants.'
      ));
      continue;
    }
    constants.set(directive.name, value);
  }

  return constants;
}
