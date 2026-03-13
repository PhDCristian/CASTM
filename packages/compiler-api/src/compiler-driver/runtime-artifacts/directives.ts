import {
  AssertionInfo,
  AstProgram,
  Diagnostic,
  ErrorCodes,
  IoConfigInfo,
  SourceSpan,
  makeDiagnostic
} from '@castm/compiler-ir';
import { parseNumericLiteral } from '../numbers.js';
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
      const row = parseNumericLiteral(statement.at.row);
      const col = parseNumericLiteral(statement.at.col);
      const value = parseNumericLiteral(statement.equals);
      const cycle = statement.cycle !== undefined
        ? parseNumericLiteral(statement.cycle)
        : undefined;

      if (row === null || !Number.isInteger(row) || row < 0) {
        diagnostics.push(makeDiagnostic(
          ErrorCodes.Parse.InvalidSyntax,
          'error',
          statement.span,
          `Invalid assert row '${statement.at.row}'.`,
          'Assert row must be a non-negative integer.'
        ));
        continue;
      }

      if (col === null || !Number.isInteger(col) || col < 0) {
        diagnostics.push(makeDiagnostic(
          ErrorCodes.Parse.InvalidSyntax,
          'error',
          statement.span,
          `Invalid assert col '${statement.at.col}'.`,
          'Assert col must be a non-negative integer.'
        ));
        continue;
      }

      if (!/^(?:R\d+|ROUT|ZERO|RC[A-Z]+)$/i.test(statement.reg)) {
        diagnostics.push(makeDiagnostic(
          ErrorCodes.Parse.InvalidSyntax,
          'error',
          statement.span,
          `Invalid assert register '${statement.reg}'.`,
          'Use a valid register (for example R0, R1, R2, R3, ROUT, ZERO).'
        ));
        continue;
      }

      if (value === null || !Number.isInteger(value)) {
        diagnostics.push(makeDiagnostic(
          ErrorCodes.Parse.InvalidSyntax,
          'error',
          statement.span,
          `Invalid assert equals value '${statement.equals}'.`,
          'Assert equals must be an integer literal (decimal or hex).'
        ));
        continue;
      }

      if (cycle !== undefined && (cycle === null || !Number.isInteger(cycle) || cycle < 0)) {
        diagnostics.push(makeDiagnostic(
          ErrorCodes.Parse.InvalidSyntax,
          'error',
          statement.span,
          `Invalid assert cycle '${statement.cycle}'.`,
          'Assert cycle must be a non-negative integer when provided.'
        ));
        continue;
      }

      assertions.push({
        ...(cycle !== undefined ? { cycle } : {}),
        row,
        col,
        register: statement.reg,
        value,
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

      cycleLimit = parsed;
      cycleLimitSpan = { ...statement.span };
    }
  }

  return {
    ioConfig,
    cycleLimit,
    cycleLimitSpan,
    assertions
  };
}
