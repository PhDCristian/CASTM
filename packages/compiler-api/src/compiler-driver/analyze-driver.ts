import {
  AnalysisResult,
  AstProgram,
  BuildConfigAst,
  CompileOptions,
  Diagnostic,
  ErrorCodes,
  HirProgram,
  LirProgram,
  MirProgram,
  StructuredProgramAst,
  makeDiagnostic
} from '@castm/compiler-ir';
import {
  createResolveSymbolsPass,
  createValidateGridPass,
  createDesugarMemoryPass,
  createExpandAdvancedStatementsPass,
  createSlotPackPass,
  desugarAutoBundlePass,
  desugarExpressionsPass,
  desugarGotoPass,
  desugarInlineArithmeticPass,
  pruneNoopBundlesPass,
  specializePass,
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

interface EffectiveBuildSettings {
  schedulerMode: 'safe' | 'balanced' | 'aggressive';
  schedulerWindow: number;
  memoryReorderPolicy: 'strict' | 'same-address-fence';
  pruneNoopBundles: boolean;
}

function presetFromOptimize(level: BuildConfigAst['optimize']): EffectiveBuildSettings {
  if (level === 'O0') {
    return {
      schedulerMode: 'safe',
      schedulerWindow: 0,
      memoryReorderPolicy: 'strict',
      pruneNoopBundles: false
    };
  }

  if (level === 'O1') {
    return {
      schedulerMode: 'safe',
      schedulerWindow: 1,
      memoryReorderPolicy: 'strict',
      pruneNoopBundles: true
    };
  }

  if (level === 'O3') {
    return {
      schedulerMode: 'aggressive',
      schedulerWindow: 4,
      memoryReorderPolicy: 'same-address-fence',
      pruneNoopBundles: true
    };
  }

  return {
    schedulerMode: 'balanced',
    schedulerWindow: 2,
    memoryReorderPolicy: 'same-address-fence',
    pruneNoopBundles: true
  };
}

function normalizeSchedulerWindow(value: number | 'auto' | undefined, fallback: number): number {
  if (value === undefined || value === 'auto') return fallback;
  if (!Number.isFinite(value)) return fallback;
  const normalized = Math.floor(value);
  return normalized < 0 ? 0 : normalized;
}

function resolveEffectiveBuildSettings(ast: AstProgram): EffectiveBuildSettings {
  const preset = presetFromOptimize(ast.build?.optimize ?? 'O2');
  return {
    schedulerMode: ast.build?.scheduler ?? preset.schedulerMode,
    schedulerWindow: normalizeSchedulerWindow(ast.build?.schedulerWindow, preset.schedulerWindow),
    memoryReorderPolicy: ast.build?.memoryReorder === 'strict'
      ? 'strict'
      : ast.build?.memoryReorder === 'same_address_fence'
        ? 'same-address-fence'
        : preset.memoryReorderPolicy,
    pruneNoopBundles: ast.build?.pruneNoopBundles ?? preset.pruneNoopBundles
  };
}

export function analyze(input: AnalyzeInput, options: CompileOptions = {}): AnalysisResult {
  const ast = 'ast' in input ? input.ast : input;
  const structuredAst = 'ast' in input ? input.structuredAst : undefined;
  const diagnostics: Diagnostic[] = [];
  const semanticChecked = runSemanticChecker(ast, diagnostics);
  const semanticResolved = runSemanticResolver(semanticChecked.ast, diagnostics);
  const semaAst = semanticResolved.ast;

  const memory = collectDataRegions(semaAst, diagnostics);
  const runtime = collectRuntimeArtifacts(semaAst, memory.regions, diagnostics);
  const target = resolveGrid(semaAst, diagnostics);
  const strictUnsupported = options.strictUnsupported !== false;
  const buildSettings = resolveEffectiveBuildSettings(semaAst);
  const schedulerMode = buildSettings.schedulerMode;
  const effectiveSchedulerWindow = buildSettings.schedulerWindow;
  const memoryReorderPolicy = buildSettings.memoryReorderPolicy;
  const pruneNoopBundles = buildSettings.pruneNoopBundles;

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
    desugarGotoPass,
    desugarExpressionsPass,
    desugarInlineArithmeticPass,
    specializePass,
    desugarAutoBundlePass,
    createExpandAdvancedStatementsPass(strictUnsupported, target.grid),
    createSlotPackPass(target.grid, {
      window: effectiveSchedulerWindow,
      memoryReorderPolicy
    })
  ];

  if (pruneNoopBundles) {
    astPasses.push(pruneNoopBundlesPass);
  }

  const astPipeline = runStagedPipeline(
    semaAst,
    [{ name: 'desugar+advancedStatements', passes: astPasses }],
    diagnostics
  );
  const loweredAst = astPipeline.output as AstProgram;
  const schedulerPasses: string[] = [];
  if (schedulerMode !== 'safe') {
    schedulerPasses.push(`scheduler:${schedulerMode}`);
  }

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

  if (runtime.bundleLimit !== undefined && mir.bundles.length > runtime.bundleLimit) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Semantic.UnsupportedOperation,
      'error',
      runtime.bundleLimitSpan ?? semaAst.span,
      `Kernel expands to ${mir.bundles.length} bundles but limit(...) is ${runtime.bundleLimit}.`,
      'Increase limit(...) or reduce generated bundles.'
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
    bundleLimit: runtime.bundleLimit,
    assertions: runtime.assertions,
    symbols: runtime.symbols,
    loweredPasses: [
      ...semanticChecked.loweredPasses,
      ...semanticResolved.loweredPasses,
      ...astPipeline.loweredPasses,
      ...schedulerPasses,
      ...hirPipeline.loweredPasses,
      ...mirPipeline.loweredPasses,
      ...lirPipeline.loweredPasses
    ]
  };
}
