import { emitCsv } from '@openedge/compiler-backend-csv';
import { parseSource } from '@openedge/compiler-front';
import {
  AnalysisResult,
  AssertionInfo,
  AstProgram,
  CompileOptions,
  CompileResult,
  Diagnostic,
  EmitOptions,
  EmitResult,
  ErrorCodes,
  GridSpec,
  HirProgram,
  IoConfigInfo,
  LirProgram,
  MemoryRegionInfo,
  MirProgram,
  ParseResult,
  SourceSpan,
  SymbolArrayInfo,
  SymbolInfo,
  makeDiagnostic,
  runPassPipeline,
  spanAt
} from '@openedge/compiler-ir';
import { getTargetProfile } from '@openedge/lang-spec';
import {
  createResolveSymbolsPass,
  createValidateGridPass,
  desugarAutoCyclePass,
  createDesugarMemoryPass,
  createExpandPragmasPass,
  desugarExpressionsPass,
  lowerToLirPass,
  lowerToMirPass
} from './passes.js';

function hasErrors(diagnostics: Diagnostic[]): boolean {
  return diagnostics.some((d) => d.severity === 'error');
}

function parseNumericLiteral(text: string): number | null {
  const trimmed = text.trim();
  if (/^-?0x[0-9a-f]+$/i.test(trimmed)) {
    const sign = trimmed.startsWith('-') ? -1 : 1;
    const raw = trimmed.startsWith('-') ? trimmed.slice(1) : trimmed;
    return sign * parseInt(raw, 16);
  }
  if (/^-?\d+$/.test(trimmed)) {
    return parseInt(trimmed, 10);
  }
  return null;
}

interface DataRegionCollection {
  regions: MemoryRegionInfo[];
  symbolsByName: Map<string, DataSymbolInfo>;
}

interface RuntimeArtifactCollection {
  ioConfig: IoConfigInfo;
  cycleLimit?: number;
  cycleLimitSpan?: { startLine: number; startColumn: number; endLine: number; endColumn: number };
  assertions: AssertionInfo[];
  symbols: SymbolInfo;
}

interface DataSymbolInfo {
  start: number;
  length: number;
  rows?: number;
  cols?: number;
}

function parseNumericList(text: string): number[] | null {
  const normalized = text
    .replace(/[{}\[\]\(\)]/g, ' ')
    .split(/[,\s]+/)
    .map((token) => token.trim())
    .filter(Boolean);

  if (normalized.length === 0) return [];

  const values: number[] = [];
  for (const token of normalized) {
    const value = parseNumericLiteral(token);
    if (value === null) return null;
    values.push(value);
  }

  return values;
}

interface AssertionFieldTokens {
  cycleText?: string;
  rowText: string;
  colText: string;
  registerText: string;
  valueText: string;
}

interface ParsedAssertionPayload {
  cycle: number;
  row: number;
  col: number;
  register: string;
  value: number;
}

interface AssertionParseFailure {
  message: string;
  hint: string;
}

function inferDefaultAssertionCycle(ast: AstProgram, span: SourceSpan): number {
  const cycles = ast.kernel?.cycles ?? [];
  if (cycles.length === 0) return 0;

  let lastBeforeSpan: number | null = null;
  for (const cycle of cycles) {
    if (cycle.span.startLine <= span.startLine) {
      if (lastBeforeSpan === null || cycle.index > lastBeforeSpan) {
        lastBeforeSpan = cycle.index;
      }
    }
  }

  if (lastBeforeSpan !== null) return lastBeforeSpan;
  return cycles[cycles.length - 1].index;
}

function parseAssertionTokens(rawValue: string): AssertionFieldTokens | null {
  const shorthand = rawValue.match(
    /^\.assert\s+(?:cycle\s*=\s*([^\s]+)\s+)?@\s*([^,:\s]+)\s*,\s*([^:\s]+)\s*:?\s*([A-Za-z_][A-Za-z0-9_]*)\s*==\s*(.+)\s*$/i
  );
  if (shorthand) {
    return {
      cycleText: shorthand[1]?.trim(),
      rowText: shorthand[2].trim(),
      colText: shorthand[3].trim(),
      registerText: shorthand[4].trim(),
      valueText: shorthand[5].trim()
    };
  }

  const object = rawValue.match(/^\.assert\s*\{([\s\S]*)\}\s*$/i);
  if (!object) return null;

  const body = object[1];
  const cycleMatch = body.match(/\bcycle\s*:\s*([^,}]+)/i);
  const locationMatch = body.match(/\blocation\s*:\s*([^,}]+)\s*,\s*([^,}]+)/i);
  const registerMatch = body.match(/\bregister\s*:\s*([A-Za-z_][A-Za-z0-9_]*)/i);
  const valueMatch = body.match(/\bvalue\s*:\s*([^,}]+)/i);
  if (!locationMatch || !registerMatch || !valueMatch) return null;

  return {
    cycleText: cycleMatch?.[1]?.trim(),
    rowText: locationMatch[1].trim().replace(/^@/, ''),
    colText: locationMatch[2].trim(),
    registerText: registerMatch[1].trim(),
    valueText: valueMatch[1].trim()
  };
}

function parseAssertionDirectiveValue(
  ast: AstProgram,
  directiveSpan: SourceSpan,
  rawValue: string
): ParsedAssertionPayload | AssertionParseFailure {
  const tokens = parseAssertionTokens(rawValue);
  if (!tokens) {
    return {
      message: `Invalid .assert directive payload '${rawValue}'.`,
      hint: 'Expected `.assert cycle=0 @0,0 R1 == 42` or `.assert { cycle: 0, location: 0,0, register: R1, value: 42 }`.'
    };
  }

  const row = parseNumericLiteral(tokens.rowText);
  if (row === null || !Number.isInteger(row) || row < 0) {
    return {
      message: `Invalid .assert row '${tokens.rowText}'.`,
      hint: 'Row must be a non-negative integer.'
    };
  }

  const col = parseNumericLiteral(tokens.colText);
  if (col === null || !Number.isInteger(col) || col < 0) {
    return {
      message: `Invalid .assert column '${tokens.colText}'.`,
      hint: 'Column must be a non-negative integer.'
    };
  }

  let cycle: number;
  if (tokens.cycleText) {
    const parsedCycle = parseNumericLiteral(tokens.cycleText);
    if (parsedCycle === null || !Number.isInteger(parsedCycle) || parsedCycle < 0) {
      return {
        message: `Invalid .assert cycle '${tokens.cycleText}'.`,
        hint: 'Cycle must be a non-negative integer.'
      };
    }
    cycle = parsedCycle;
  } else {
    cycle = inferDefaultAssertionCycle(ast, directiveSpan);
  }

  const value = parseNumericLiteral(tokens.valueText);
  if (value === null || !Number.isInteger(value)) {
    return {
      message: `Invalid .assert value '${tokens.valueText}'.`,
      hint: 'Assertion value must be an integer literal (decimal or hex).'
    };
  }

  return {
    cycle,
    row,
    col,
    register: tokens.registerText,
    value
  };
}

function collectRuntimeArtifacts(
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
  let cycleLimitSpan: { startLine: number; startColumn: number; endLine: number; endColumn: number } | undefined;
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

function parseDataDirectiveValue(rawValue: string): { explicitStart?: number; values: number[] } | null {
  const trimmed = rawValue.trim();
  const explicitAddressMatch = trimmed.match(/^(-?0x[0-9a-f]+|-?\d+)\s*\{([\s\S]*)\}$/i);

  let explicitStart: number | undefined;
  let valuesBody = '';

  if (explicitAddressMatch) {
    const parsedStart = parseNumericLiteral(explicitAddressMatch[1]);
    if (parsedStart === null) return null;
    explicitStart = parsedStart;
    valuesBody = explicitAddressMatch[2].trim();
  } else {
    const bodyMatch = trimmed.match(/^\{([\s\S]*)\}$/);
    if (!bodyMatch) return null;
    valuesBody = bodyMatch[1].trim();
  }

  if (valuesBody.length === 0) {
    return { explicitStart, values: [] };
  }

  const values: number[] = [];
  for (const token of valuesBody.split(',')) {
    const parsed = parseNumericLiteral(token);
    if (parsed === null) return null;
    values.push(parsed);
  }

  return { explicitStart, values };
}

function parseData2dDirectiveValue(rawValue: string): { rows: number; cols: number; values: number[] } | null {
  const trimmed = rawValue.trim();
  const match = trimmed.match(/^\[([^\]]+)\]\s*(?:\[([^\]]+)\])?\s*(?:\{([\s\S]*)\})?$/);
  if (!match) return null;

  const dim1 = parseNumericLiteral(match[1].trim());
  if (dim1 === null || !Number.isInteger(dim1) || dim1 <= 0) return null;

  let rows: number;
  let cols: number;
  if (match[2] !== undefined) {
    const dim2 = parseNumericLiteral(match[2].trim());
    if (dim2 === null || !Number.isInteger(dim2) || dim2 <= 0) return null;
    rows = dim1;
    cols = dim2;
  } else {
    const sqrt = Math.sqrt(dim1);
    if (Number.isInteger(sqrt)) {
      rows = sqrt;
      cols = sqrt;
    } else {
      rows = 1;
      cols = dim1;
    }
  }

  const total = rows * cols;
  if (match[3] === undefined) {
    return {
      rows,
      cols,
      values: Array.from({ length: total }, () => 0)
    };
  }

  const body = match[3].trim();
  const values: number[] = [];
  if (body.length > 0) {
    for (const token of body.split(',')) {
      const parsed = parseNumericLiteral(token);
      if (parsed === null) return null;
      values.push(parsed);
    }
  }
  if (values.length !== total) return null;
  return { rows, cols, values };
}

function collectDataRegions(ast: AstProgram, diagnostics: Diagnostic[]): DataRegionCollection {
  const regions: MemoryRegionInfo[] = [];
  const symbolsByName = new Map<string, DataSymbolInfo>();
  const directives = ast.kernel?.directives ?? [];
  let nextAddress = 0;

  for (const directive of directives) {
    if (directive.kind !== 'data' && directive.kind !== 'data2d') continue;

    if (symbolsByName.has(directive.name)) {
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Parse.InvalidSyntax,
        'error',
        directive.span,
        `Duplicate data symbol '${directive.name}'.`,
        'Use unique names across .data and .data2d declarations.'
      ));
      continue;
    }

    if (directive.kind === 'data') {
      const parsed = parseDataDirectiveValue(directive.value);
      if (!parsed) {
        diagnostics.push(makeDiagnostic(
          ErrorCodes.Parse.InvalidSyntax,
          'error',
          directive.span,
          `Invalid .data directive for '${directive.name}'.`,
          'Expected .data name { 1, 2, 3 } or .data name 100 { 1, 2, 3 }.'
        ));
        continue;
      }

      const start = parsed.explicitStart ?? nextAddress;
      regions.push({
        name: directive.name,
        start,
        values: parsed.values
      });
      symbolsByName.set(directive.name, {
        start,
        length: parsed.values.length
      });
      nextAddress = Math.max(nextAddress, start + parsed.values.length * 4);
      continue;
    }

    const parsed2d = parseData2dDirectiveValue(directive.value);
    if (!parsed2d) {
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Parse.InvalidSyntax,
        'error',
        directive.span,
        `Invalid .data2d directive for '${directive.name}'.`,
        'Expected .data2d name[rows][cols] { ... } or .data2d name[total].'
      ));
      continue;
    }

    const start = nextAddress;
    regions.push({
      name: directive.name,
      start,
      values: parsed2d.values,
      rows: parsed2d.rows,
      cols: parsed2d.cols
    });
    symbolsByName.set(directive.name, {
      start,
      length: parsed2d.values.length,
      rows: parsed2d.rows,
      cols: parsed2d.cols
    });
    nextAddress = Math.max(nextAddress, start + parsed2d.values.length * 4);
  }

  return { regions, symbolsByName };
}

function resolveGrid(ast: AstProgram, options: CompileOptions, diagnostics: Diagnostic[]): { targetProfileId: string; grid: GridSpec } | null {
  const targetProfileId = options.targetProfile ?? ast.targetProfileId;
  if (!targetProfileId) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.MissingTarget,
      'error',
      spanAt(1, 1, 1),
      'Missing target profile for analysis.',
      'Set target in source (target "...") or CompileOptions.targetProfile.'
    ));
    return null;
  }

  const profile = getTargetProfile(targetProfileId);
  if (!profile) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Semantic.UnknownTargetProfile,
      'error',
      spanAt(1, 1, 1),
      `Unknown target profile '${targetProfileId}'.`,
      'Check @openedge/lang-spec target-profiles catalog.'
    ));
    return null;
  }

  const rows = options.grid?.rows ?? profile.grid.rows;
  const cols = options.grid?.cols ?? profile.grid.cols;
  const topology = options.grid?.topology ?? profile.grid.topology;

  if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows <= 0 || cols <= 0) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Semantic.InvalidGridSpec,
      'error',
      spanAt(1, 1, 1),
      `Invalid grid dimensions rows=${rows}, cols=${cols}.`,
      'Rows and cols must be positive integers.'
    ));
    return null;
  }

  return {
    targetProfileId,
    grid: {
      rows,
      cols,
      topology,
      wrapPolicy: topology === 'torus' ? 'wrap' : 'clamp'
    }
  };
}

export function parse(source: string): ParseResult {
  return parseSource(source);
}

export function analyze(ast: AstProgram, options: CompileOptions = {}): AnalysisResult {
  const diagnostics: Diagnostic[] = [];
  const memory = collectDataRegions(ast, diagnostics);
  const runtime = collectRuntimeArtifacts(ast, memory.regions, diagnostics);
  const target = resolveGrid(ast, options, diagnostics);
  const strictUnsupported = options.strictUnsupported !== false;

  if (!target) {
    return {
      success: false,
      diagnostics,
      ast,
      memoryRegions: memory.regions,
      ioConfig: runtime.ioConfig,
      assertions: runtime.assertions,
      symbols: runtime.symbols,
      loweredPasses: []
    };
  }

  const astPasses = [
    createDesugarMemoryPass(memory.symbolsByName),
    desugarExpressionsPass,
    desugarAutoCyclePass,
    createExpandPragmasPass(strictUnsupported, target.grid)
  ];

  const astPipeline = runPassPipeline(ast, astPasses, diagnostics);
  const loweredAst = astPipeline.output as AstProgram;

  const hirPasses = [
    createResolveSymbolsPass(target.targetProfileId, target.grid),
    createValidateGridPass(target.grid)
  ];

  const hirPipeline = runPassPipeline(loweredAst, hirPasses, diagnostics);
  const hir = hirPipeline.output as HirProgram;

  const mirPipeline = runPassPipeline(hir, [lowerToMirPass], diagnostics);
  const mir = mirPipeline.output as MirProgram;
  const lirPipeline = runPassPipeline(mir, [lowerToLirPass], diagnostics);
  const lir = lirPipeline.output as LirProgram;

  if (runtime.cycleLimit !== undefined && mir.cycles.length > runtime.cycleLimit) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Semantic.UnsupportedOperation,
      'error',
      runtime.cycleLimitSpan ?? ast.span,
      `Kernel expands to ${mir.cycles.length} cycles but .limit is ${runtime.cycleLimit}.`,
      'Increase .limit or reduce generated cycles.'
    ));
  }

  return {
    success: !hasErrors(diagnostics),
    diagnostics,
    ast: loweredAst,
    hir,
    mir,
    lir,
    memoryRegions: memory.regions,
    ioConfig: runtime.ioConfig,
    cycleLimit: runtime.cycleLimit,
    assertions: runtime.assertions,
    symbols: runtime.symbols,
    loweredPasses: [
      ...astPipeline.loweredPasses,
      ...hirPipeline.loweredPasses,
      ...mirPipeline.loweredPasses,
      ...lirPipeline.loweredPasses
    ]
  };
}

export function emit(program: MirProgram | LirProgram, backendOptions: EmitOptions = {}): EmitResult {
  return emitCsv(program, backendOptions);
}

export function compile(source: string, options: CompileOptions = {}): CompileResult {
  const parseResult = parse(source);
  const diagnostics: Diagnostic[] = [...parseResult.diagnostics];
  const want = new Set(options.emitArtifacts ?? ['ast', 'hir', 'mir', 'lir', 'csv']);
  const parsedRuntime = parseResult.ast
    ? collectRuntimeArtifacts(parseResult.ast, [], diagnostics)
    : {
        ioConfig: { loadAddrs: [], storeAddrs: [] },
        cycleLimit: undefined,
        cycleLimitSpan: undefined,
        assertions: [],
        symbols: { constants: {}, aliases: {}, arrays: [], labels: {} }
      };

  if (!parseResult.ast) {
    return {
      success: !hasErrors(diagnostics),
      diagnostics,
      artifacts: {},
      stats: {
        cycles: 0,
        instructions: 0,
        loweredPasses: []
      }
    };
  }

  if (hasErrors(parseResult.diagnostics)) {
    return {
      success: false,
      diagnostics,
      artifacts: {
        ast: want.has('ast') ? parseResult.ast : undefined,
        memoryRegions: [],
        ioConfig: parsedRuntime.ioConfig,
        cycleLimit: parsedRuntime.cycleLimit,
        assertions: parsedRuntime.assertions,
        symbols: parsedRuntime.symbols
      },
      stats: {
        cycles: parseResult.ast.kernel?.cycles.length ?? 0,
        instructions: 0,
        loweredPasses: []
      }
    };
  }

  const analysis = analyze(parseResult.ast, {
    ...options,
    targetProfile: options.targetProfile ?? parseResult.ast.targetProfileId ?? undefined
  });
  diagnostics.push(...analysis.diagnostics);

  let csv: string | undefined;
  if ((analysis.lir || analysis.mir) && want.has('csv')) {
    const emitted = emit(analysis.lir ?? analysis.mir!, { includeCycleHeader: true });
    diagnostics.push(...emitted.diagnostics);
    csv = emitted.csv;
  }

  const instructions = analysis.mir
    ? analysis.mir.cycles.reduce((acc, cycle) => acc + cycle.slots.length, 0)
    : 0;

  return {
    success: !hasErrors(diagnostics),
    diagnostics,
    artifacts: {
      csv,
      ast: want.has('ast') ? analysis.ast : undefined,
      hir: want.has('hir') ? analysis.hir : undefined,
      mir: want.has('mir') ? analysis.mir : undefined,
      lir: want.has('lir') ? analysis.lir : undefined,
      memoryRegions: analysis.memoryRegions ?? [],
      ioConfig: analysis.ioConfig,
      cycleLimit: analysis.cycleLimit,
      assertions: analysis.assertions,
      symbols: analysis.symbols
    },
    stats: {
      cycles: analysis.mir?.cycles.length ?? analysis.ast?.kernel?.cycles.length ?? 0,
      instructions,
      loweredPasses: analysis.loweredPasses
    }
  };
}

export * from './passes.js';
export * from '@openedge/compiler-ir';
