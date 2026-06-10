import {
  AssertionInfo,
  AstProgram,
  Diagnostic,
  ErrorCodes,
  IoConfigInfo,
  SourceSpan,
  makeDiagnostic
} from '@castm/compiler-ir';
import { parseAssertionDirectiveValue } from '../assertions.js';
import { parseNumericLiteral } from '../numbers.js';
import { SymbolCollections } from './symbols.js';

export interface RuntimeDirectiveArtifacts {
  ioConfig: IoConfigInfo;
  bundleLimit?: number;
  bundleLimitSpan?: SourceSpan;
  assertions: AssertionInfo[];
}

export function collectDirectiveArtifacts(
  ast: AstProgram,
  diagnostics: Diagnostic[],
  symbols: SymbolCollections
): RuntimeDirectiveArtifacts {
  const ioConfig: IoConfigInfo = { loadAddrs: [], storeAddrs: [] };
  let bundleLimit: number | undefined;
  let bundleLimitSpan: SourceSpan | undefined;
  const assertions: AssertionInfo[] = [];

  const declarations = ast.kernel?.directives ?? [];
  for (const declaration of declarations) {
    if (declaration.kind === 'const') {
      symbols.constants[declaration.name] = declaration.value;
      continue;
    }

    if (declaration.kind === 'alias') {
      symbols.aliases[declaration.name] = declaration.value;
      continue;
    }
  }

  const runtimeStatements = ast.kernel?.runtime ?? [];
  for (const statement of runtimeStatements) {
    if (statement.kind === 'io_load' || statement.kind === 'io_store') {
      const parsed: number[] = [];
      let invalidAddress: string | null = null;
      for (const address of statement.addresses) {
        const numeric = parseNumericLiteral(address);
        if (numeric === null || !Number.isInteger(numeric)) {
          invalidAddress = address;
          break;
        }
        parsed.push(numeric);
      }
      if (invalidAddress !== null) {
        diagnostics.push(makeDiagnostic(
          ErrorCodes.Parse.InvalidSyntax,
          'error',
          statement.span,
          `Invalid ${statement.kind === 'io_load' ? 'io.load' : 'io.store'} address '${invalidAddress}'.`,
          'Expected integer addresses (decimal or hex).'
        ));
        continue;
      }
      if (parsed.length === 0) {
        diagnostics.push(makeDiagnostic(
          ErrorCodes.Parse.InvalidSyntax,
          'error',
          statement.span,
          `Invalid ${statement.kind === 'io_load' ? 'io.load' : 'io.store'} statement.`,
          `Expected at least one address: ${statement.kind === 'io_load' ? 'io.load(100, 104)' : 'io.store(200)'}`
        ));
        continue;
      }
      if (parsed.some((value) => value < 0)) {
        diagnostics.push(makeDiagnostic(
          ErrorCodes.Parse.InvalidSyntax,
          'error',
          statement.span,
          `Invalid ${statement.kind === 'io_load' ? 'io.load' : 'io.store'} addresses.`,
          'I/O addresses must be non-negative integers.'
        ));
        continue;
      }

      if (statement.kind === 'io_load') {
        ioConfig.loadAddrs.push(...parsed);
      } else {
        ioConfig.storeAddrs.push(...parsed);
      }
      continue;
    }

    if (statement.kind === 'assert') {
      const assertionRaw = /^assert\s*\(/i.test(statement.raw)
        ? statement.raw
        : [
            `assert(at=@${statement.at.row},${statement.at.col}`,
            ` reg=${statement.reg}`,
            ` equals=${statement.equals}`,
            statement.bundle !== undefined ? ` bundle=${statement.bundle}` : ''
          ].join(',') + ')';
      const parsed = parseAssertionDirectiveValue(ast, statement.span, assertionRaw);

      if ('message' in parsed) {
        diagnostics.push(makeDiagnostic(
          ErrorCodes.Parse.InvalidSyntax,
          'error',
          statement.span,
          parsed.message,
          parsed.hint
        ));
        continue;
      }

      if (!/^(?:R\d+|ROUT|ZERO|RC[A-Z]+)$/i.test(parsed.register)) {
        diagnostics.push(makeDiagnostic(
          ErrorCodes.Parse.InvalidSyntax,
          'error',
          statement.span,
          `Invalid assert register '${parsed.register}'.`,
          'Use a valid register (for example R0, R1, R2, R3, ROUT, ZERO).'
        ));
        continue;
      }

      assertions.push({
        bundle: parsed.bundle,
        row: parsed.row,
        col: parsed.col,
        register: parsed.register,
        value: parsed.value,
        raw: statement.raw,
        span: { ...statement.span }
      });
      continue;
    }

    if (statement.kind === 'limit') {
      const parsed = parseNumericLiteral(statement.value);
      if (parsed === null || parsed < 0 || !Number.isInteger(parsed)) {
        diagnostics.push(makeDiagnostic(
          ErrorCodes.Parse.InvalidSyntax,
          'error',
          statement.span,
          `Invalid limit(...) payload '${statement.value}'.`,
          'Expected a non-negative integer: limit(100)'
        ));
        continue;
      }

      bundleLimit = parsed;
      bundleLimitSpan = { ...statement.span };
    }
  }

  return {
    ioConfig,
    bundleLimit,
    bundleLimitSpan,
    assertions
  };
}
