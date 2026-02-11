import {
  AnalysisResult,
  AstProgram,
  CompileOptions,
  Diagnostic,
  ErrorCodes,
  HirProgram,
  LirProgram,
  MirProgram,
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
import { collectRuntimeArtifacts } from './runtime-artifacts.js';
import { hasErrors } from './utils.js';

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
