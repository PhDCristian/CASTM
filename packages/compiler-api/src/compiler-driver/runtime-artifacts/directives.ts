import {
  AssertionInfo,
  AstProgram,
  Diagnostic,
  ErrorCodes,
  IoConfigInfo,
  SourceSpan,
  makeDiagnostic
} from '@openedge/compiler-ir';
import { parseAssertionDirectiveValue } from '../assertions.js';
import { parseNumericList, parseNumericLiteral } from '../numbers.js';
import { SymbolCollections } from './symbols.js';

export interface RuntimeDirectiveArtifacts {
  ioConfig: IoConfigInfo;
  cycleLimit?: number;
  cycleLimitSpan?: SourceSpan;
  assertions: AssertionInfo[];
}

export function collectDirectiveArtifacts(
  ast: AstProgram,
  diagnostics: Diagnostic[],
  symbols: SymbolCollections
): RuntimeDirectiveArtifacts {
  const ioConfig: IoConfigInfo = { loadAddrs: [], storeAddrs: [] };
  let cycleLimit: number | undefined;
  let cycleLimitSpan: SourceSpan | undefined;
  const assertions: AssertionInfo[] = [];

  const directives = ast.kernel?.directives ?? [];
  for (const directive of directives) {
    if (directive.kind === 'const') {
      symbols.constants[directive.name] = directive.value;
      continue;
    }

    if (directive.kind === 'alias') {
      symbols.aliases[directive.name] = directive.value;
      continue;
    }

    if (directive.kind === 'io_load' || directive.kind === 'io_store') {
      const payloadMatch = directive.value.match(/^\.io_(?:load|store)\s+(.+)$/i);
      const payload = payloadMatch ? payloadMatch[1].trim() : '';
      const parsed = parseNumericList(payload);
      if (parsed === null) {
        diagnostics.push(makeDiagnostic(
          ErrorCodes.Parse.InvalidSyntax,
          'error',
          directive.span,
          `Invalid ${directive.kind} directive payload '${payload}'.`,
          'Expected numeric addresses separated by commas or spaces.'
        ));
        continue;
      }
      if (parsed.length === 0) {
        diagnostics.push(makeDiagnostic(
          ErrorCodes.Parse.InvalidSyntax,
          'error',
          directive.span,
          `Invalid ${directive.kind} directive payload '${payload}'.`,
          'Expected at least one address: .io_load 100, 104'
        ));
        continue;
      }
      if (parsed.some((value) => value < 0)) {
        diagnostics.push(makeDiagnostic(
          ErrorCodes.Parse.InvalidSyntax,
          'error',
          directive.span,
          `Invalid ${directive.kind} directive payload '${payload}'.`,
          'I/O addresses must be non-negative integers.'
        ));
        continue;
      }

      if (directive.kind === 'io_load') {
        ioConfig.loadAddrs.push(...parsed);
      } else {
        ioConfig.storeAddrs.push(...parsed);
      }
      continue;
    }

    if (directive.kind === 'assert') {
      const parsedAssertion = parseAssertionDirectiveValue(ast, directive.span, directive.value);
      if ('message' in parsedAssertion) {
        diagnostics.push(makeDiagnostic(
          ErrorCodes.Parse.InvalidSyntax,
          'error',
          directive.span,
          parsedAssertion.message,
          parsedAssertion.hint
        ));
        continue;
      }

      assertions.push({
        cycle: parsedAssertion.cycle,
        row: parsedAssertion.row,
        col: parsedAssertion.col,
        register: parsedAssertion.register,
        value: parsedAssertion.value,
        raw: directive.value,
        span: { ...directive.span }
      });
      continue;
    }

    if (directive.kind === 'limit') {
      const payloadMatch = directive.value.match(/^\.limit\s*(?:=\s*)?(.+)$/i);
      const payload = payloadMatch ? payloadMatch[1].trim() : '';
      const parsed = parseNumericLiteral(payload);
      if (parsed === null || parsed < 0 || !Number.isInteger(parsed)) {
        diagnostics.push(makeDiagnostic(
          ErrorCodes.Parse.InvalidSyntax,
          'error',
          directive.span,
          `Invalid .limit directive payload '${payload}'.`,
          'Expected a non-negative integer: .limit 100'
        ));
        continue;
      }

      cycleLimit = parsed;
      cycleLimitSpan = { ...directive.span };
    }
  }

  return {
    ioConfig,
    cycleLimit,
    cycleLimitSpan,
    assertions
  };
}
