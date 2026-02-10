import { emitCsv } from '@openedge/compiler-backend-csv';
import { parseSource } from '@openedge/compiler-front';
import {
  AnalysisResult,
  AstProgram,
  CompileOptions,
  CompileResult,
  Diagnostic,
  EmitOptions,
  EmitResult,
  ErrorCodes,
  GridSpec,
  HirProgram,
  MirProgram,
  ParseResult,
  makeDiagnostic,
  runPassPipeline,
  spanAt
} from '@openedge/compiler-ir';
import { getTargetProfile } from '@openedge/lang-spec';
import {
  createResolveSymbolsPass,
  createValidateGridPass,
  desugarAutoCyclePass,
  desugarExpressionsPass,
  desugarMemoryPass,
  expandPragmasPass,
  lowerToMirPass
} from './passes.js';

function hasErrors(diagnostics: Diagnostic[]): boolean {
  return diagnostics.some((d) => d.severity === 'error');
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
  const target = resolveGrid(ast, options, diagnostics);

  if (!target) {
    return {
      success: false,
      diagnostics,
      ast,
      loweredPasses: []
    };
  }

  const astPasses = [
    desugarMemoryPass,
    desugarExpressionsPass,
    desugarAutoCyclePass,
    expandPragmasPass
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

  return {
    success: !hasErrors(diagnostics),
    diagnostics,
    ast: loweredAst,
    hir,
    mir,
    loweredPasses: [...astPipeline.loweredPasses, ...hirPipeline.loweredPasses, ...mirPipeline.loweredPasses]
  };
}

export function emit(program: MirProgram, backendOptions: EmitOptions = {}): EmitResult {
  return emitCsv(program, backendOptions);
}

export function compile(source: string, options: CompileOptions = {}): CompileResult {
  const parseResult = parse(source);
  const diagnostics: Diagnostic[] = [...parseResult.diagnostics];
  const want = new Set(options.emitArtifacts ?? ['ast', 'hir', 'mir', 'csv']);

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
        ast: want.has('ast') ? parseResult.ast : undefined
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
  if (analysis.mir && want.has('csv')) {
    const emitted = emit(analysis.mir, { includeCycleHeader: true });
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
      mir: want.has('mir') ? analysis.mir : undefined
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
