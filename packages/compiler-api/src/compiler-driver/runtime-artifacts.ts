import {
  AssertionInfo,
  AstProgram,
  Diagnostic,
  ErrorCodes,
  IoConfigInfo,
  MemoryRegionInfo,
  SourceSpan,
  SymbolArrayInfo,
  SymbolInfo,
  makeDiagnostic
} from '@openedge/compiler-ir';
import { parseAssertionDirectiveValue } from './assertions.js';
import { parseNumericList, parseNumericLiteral } from './numbers.js';

export interface RuntimeArtifactCollection {
  ioConfig: IoConfigInfo;
  cycleLimit?: number;
  cycleLimitSpan?: SourceSpan;
  assertions: AssertionInfo[];
  symbols: SymbolInfo;
}

export function createEmptyRuntimeArtifacts(): RuntimeArtifactCollection {
  return {
    ioConfig: { loadAddrs: [], storeAddrs: [] },
    cycleLimit: undefined,
    cycleLimitSpan: undefined,
    assertions: [],
    symbols: { constants: {}, aliases: {}, arrays: [], labels: {} }
  };
}

export function collectRuntimeArtifacts(
  ast: AstProgram,
  dataRegions: MemoryRegionInfo[],
  diagnostics: Diagnostic[]
): RuntimeArtifactCollection {
  const constants: Record<string, string> = {};
  const aliases: Record<string, string> = {};
  const arrays: SymbolArrayInfo[] = [];
  const labels: Record<string, number> = {};
  const ioConfig: IoConfigInfo = { loadAddrs: [], storeAddrs: [] };
  let cycleLimit: number | undefined;
  let cycleLimitSpan: SourceSpan | undefined;
  const assertions: AssertionInfo[] = [];

  for (const region of dataRegions) {
    if (!region.name) continue;
    arrays.push({
      name: region.name,
      start: region.start,
      length: region.values.length,
      ...(region.rows !== undefined ? { rows: region.rows } : {}),
      ...(region.cols !== undefined ? { cols: region.cols } : {})
    });
  }

  for (const cycle of ast.kernel?.cycles ?? []) {
    if (!cycle.label) continue;
    labels[cycle.label] = cycle.index;
  }

  const directives = ast.kernel?.directives ?? [];
  for (const directive of directives) {
    if (directive.kind === 'const') {
      constants[directive.name] = directive.value;
      continue;
    }

    if (directive.kind === 'alias') {
      aliases[directive.name] = directive.value;
      continue;
    }

    if (directive.kind !== 'raw') continue;

    if (directive.name === 'io_load' || directive.name === 'io_store') {
      const payloadMatch = directive.value.match(/^\.io_(?:load|store)\s+(.+)$/i);
      const payload = payloadMatch ? payloadMatch[1].trim() : '';
      const parsed = parseNumericList(payload);
      if (parsed === null) {
        diagnostics.push(makeDiagnostic(
          ErrorCodes.Parse.InvalidSyntax,
          'error',
          directive.span,
          `Invalid ${directive.name} directive payload '${payload}'.`,
          'Expected numeric addresses separated by commas or spaces.'
        ));
        continue;
      }
      if (parsed.length === 0) {
        diagnostics.push(makeDiagnostic(
          ErrorCodes.Parse.InvalidSyntax,
          'error',
          directive.span,
          `Invalid ${directive.name} directive payload '${payload}'.`,
          'Expected at least one address: .io_load 100, 104'
        ));
        continue;
      }
      if (parsed.some((value) => value < 0)) {
        diagnostics.push(makeDiagnostic(
          ErrorCodes.Parse.InvalidSyntax,
          'error',
          directive.span,
          `Invalid ${directive.name} directive payload '${payload}'.`,
          'I/O addresses must be non-negative integers.'
        ));
        continue;
      }

      if (directive.name === 'io_load') {
        ioConfig.loadAddrs.push(...parsed);
      } else {
        ioConfig.storeAddrs.push(...parsed);
      }
      continue;
    }

    if (directive.name === 'assert') {
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

    if (directive.name === 'limit') {
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
    assertions,
    symbols: { constants, aliases, arrays, labels }
  };
}
