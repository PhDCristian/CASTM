import { Diagnostic, KernelAst } from '@openedge/compiler-ir';
import { ErrorCodes, makeDiagnostic, spanAt } from '@openedge/compiler-ir';
import { parseDirective } from './declarations.js';
import { parseAdvancedStatementAsPragma } from './statements.js';
import { evaluateNumericExpression, parseNumber } from '../parser-utils/numbers.js';

export interface ConsumeKernelDirectivesInput {
  lineNo: number;
  clean: string;
  kernel: KernelAst | null;
  kernelConstants: Map<string, number>;
  diagnostics: Diagnostic[];
}

export interface ConsumeKernelDirectivesResult {
  handled: boolean;
  kernelConstants: Map<string, number>;
}

export function consumeKernelDirectivesStatement(
  input: ConsumeKernelDirectivesInput
): ConsumeKernelDirectivesResult {
  const { lineNo, clean, kernel, diagnostics } = input;
  const kernelConstants = input.kernelConstants;

  const configMatch = clean.match(/^config\s*\(\s*([^,]+)\s*,\s*([^\)]+)\)\s*;?\s*$/i);
  if (configMatch && kernel) {
    kernel.config = {
      mask: parseNumber(configMatch[1]),
      startAddr: parseNumber(configMatch[2]),
      span: spanAt(lineNo, 1, clean.length)
    };
    return { handled: true, kernelConstants };
  }

  const advancedPragmaText = parseAdvancedStatementAsPragma(clean);
  if (advancedPragmaText && kernel) {
    kernel.pragmas.push({
      text: advancedPragmaText,
      span: spanAt(lineNo, 1, clean.length)
    });
    return { handled: true, kernelConstants };
  }

  const pragmaMatch = clean.match(/^#pragma\s+([A-Za-z_][A-Za-z0-9_]*)/i);
  if (pragmaMatch && kernel) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      spanAt(lineNo, 1, clean.length),
      `Legacy pragma syntax is not supported: '${clean}'.`,
      'Use canonical statements (for example route(...), reduce(...), scan(...)) and explicit runtime/at syntax.'
    ));
    return { handled: true, kernelConstants };
  }

  const directive = parseDirective(clean, lineNo);
  if (directive && kernel) {
    kernel.directives.push(directive);
    if (directive.kind === 'const') {
      const value = evaluateNumericExpression(directive.value, kernelConstants, new Map());
      if (value === null) {
        diagnostics.push(makeDiagnostic(
          ErrorCodes.Parse.InvalidSyntax,
          'error',
          directive.span,
          `Invalid numeric value for constant '${directive.name}': '${directive.value}'.`,
          'Use integer expressions referencing previously declared constants.'
        ));
      } else {
        kernelConstants.set(directive.name, value);
      }
    }
    return { handled: true, kernelConstants };
  }

  return { handled: false, kernelConstants };
}
