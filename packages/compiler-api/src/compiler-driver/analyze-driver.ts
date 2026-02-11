import {
  AnalysisResult,
  AstProgram,
  CompileOptions,
  Diagnostic,
  ErrorCodes,
  HirProgram,
  LirProgram,
  MirProgram,
  StructuredProgramAst,
  makeDiagnostic
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
import { runSemanticChecker, runSemanticResolver } from './semantic.js';
import { runStagedPipeline } from './pipeline.js';

export type AnalyzeInput =
  | AstProgram
  | {
      ast: AstProgram;
      structuredAst?: StructuredProgramAst;
    };

export function analyze(input: AnalyzeInput, options: CompileOptions = {}): AnalysisResult {
  const ast = 'ast' in input ? input.ast : input;
  const structuredAst = 'ast' in input ? input.structuredAst : undefined;
  const diagnostics: Diagnostic[] = [];
  const semanticChecked = runSemanticChecker(ast, diagnostics);
  const semanticResolved = runSemanticResolver(semanticChecked.ast, diagnostics);
  const semaAst = semanticResolved.ast;

  const memory = collectDataRegions(semaAst, diagnostics);
  const runtime = collectRuntimeArtifacts(semaAst, memory.regions, diagnostics);
  const target = resolveGrid(semaAst, options, diagnostics);
  const strictUnsupported = options.strictUnsupported !== false;

  if (!target) {
    return {
      success: false,
      diagnostics,
      structuredAst,
      ast: semaAst,
      memoryRegions: memory.regions,
      ioConfig: runtime.ioConfig,
      assertions: runtime.assertions,
      symbols: runtime.symbols,
      loweredPasses: [...semanticChecked.loweredPasses, ...semanticResolved.loweredPasses]
    };
  }

  const astPasses = [
    createDesugarMemoryPass(memory.symbolsByName),
    desugarExpressionsPass,
    desugarAutoCyclePass,
    createExpandPragmasPass(strictUnsupported, target.grid)
  ];

  const astPipeline = runStagedPipeline(
    semaAst,
    [{ name: 'desugar+pragmas', passes: astPasses }],
    diagnostics
  );
  const loweredAst = astPipeline.output as AstProgram;

  const hirPasses = [
    createResolveSymbolsPass(target.targetProfileId, target.grid),
    createValidateGridPass(target.grid)
  ];

  const hirPipeline = runStagedPipeline(
    loweredAst,
    [{ name: 'resolve+validate', passes: hirPasses }],
    diagnostics
  );
  const hir = hirPipeline.output as HirProgram;

  const mirPipeline = runStagedPipeline(
    hir,
    [{ name: 'lower-mir', passes: [lowerToMirPass] }],
    diagnostics
  );
  const mir = mirPipeline.output as MirProgram;
  const lirPipeline = runStagedPipeline(
    mir,
    [{ name: 'lower-lir', passes: [lowerToLirPass] }],
    diagnostics
  );
  const lir = lirPipeline.output as LirProgram;

  if (runtime.cycleLimit !== undefined && mir.cycles.length > runtime.cycleLimit) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Semantic.UnsupportedOperation,
      'error',
      runtime.cycleLimitSpan ?? semaAst.span,
      `Kernel expands to ${mir.cycles.length} cycles but .limit is ${runtime.cycleLimit}.`,
      'Increase .limit or reduce generated cycles.'
    ));
  }

  return {
    success: !hasErrors(diagnostics),
    diagnostics,
    structuredAst,
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
      ...semanticChecked.loweredPasses,
      ...semanticResolved.loweredPasses,
      ...astPipeline.loweredPasses,
      ...hirPipeline.loweredPasses,
      ...mirPipeline.loweredPasses,
      ...lirPipeline.loweredPasses
    ]
  };
}
