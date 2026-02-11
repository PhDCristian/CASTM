import { emitCsv } from '@openedge/compiler-backend-csv';
import { parseStructuredSource } from '@openedge/compiler-front';
import {
  AnalysisResult,
  AstProgram,
  CompileOptions,
  CompileResult,
  Diagnostic,
  EmitOptions,
  EmitResult,
  ErrorCodes,
  HirProgram,
  LirProgram,
  MirProgram,
  ParseResult,
  makeDiagnostic,
  runPassPipeline
} from '@openedge/compiler-ir';
import {
  createResolveSymbolsPass,
  createValidateGridPass,
  createDesugarMemoryPass,
  createExpandPragmasPass,
  desugarAutoCyclePass,
  desugarExpressionsPass,
  lowerToLirPass,
  lowerToMirPass
} from '../passes.js';
import { collectDataRegions } from './data-regions.js';
import { resolveGrid } from './grid-resolver.js';
import {
  collectRuntimeArtifacts,
  createEmptyRuntimeArtifacts
} from './runtime-artifacts.js';

function hasErrors(diagnostics: Diagnostic[]): boolean {
  return diagnostics.some((d) => d.severity === 'error');
}

export function parse(source: string, options: CompileOptions = {}): ParseResult {
  const parsed = parseStructuredSource(source);
  const diagnostics = [...parsed.diagnostics];
  return {
    ...parsed,
    success: !hasErrors(diagnostics),
    diagnostics
  };
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
      structuredAst: undefined,
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
    structuredAst: undefined,
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
  const parseResult = parse(source, options);
  const diagnostics: Diagnostic[] = [...parseResult.diagnostics];
  const want = new Set(options.emitArtifacts ?? ['structured', 'ast', 'hir', 'mir', 'lir', 'csv']);
  const parsedRuntime = parseResult.ast
    ? collectRuntimeArtifacts(parseResult.ast, [], diagnostics)
    : createEmptyRuntimeArtifacts();

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
        structuredAst: want.has('structured') ? parseResult.structuredAst : undefined,
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
      structuredAst: want.has('structured') ? parseResult.structuredAst : undefined,
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
