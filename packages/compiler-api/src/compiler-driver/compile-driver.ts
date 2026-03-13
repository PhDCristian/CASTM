import {
  AstProgram,
  CompileOptions,
  CompileResult,
  Diagnostic,
  MirProgram
} from '@castm/compiler-ir';
import {
  collectRuntimeArtifacts,
  createEmptyRuntimeArtifacts
} from './runtime-artifacts.js';
import { hasErrors } from './utils.js';
import { analyze } from './analyze-driver.js';
import { emit } from './emit-driver.js';
import { parse } from './parse-driver.js';

function inferSchedulerMode(ast: AstProgram | undefined): 'safe' | 'balanced' | 'aggressive' {
  if (!ast?.build) return 'balanced';
  if (ast.build.scheduler) return ast.build.scheduler;
  if (ast.build.optimize === 'O0' || ast.build.optimize === 'O1') return 'safe';
  if (ast.build.optimize === 'O3') return 'aggressive';
  return 'balanced';
}

function computeMirStats(mir: MirProgram | undefined) {
  if (!mir) {
    return {
      cycles: 0,
      instructions: 0,
      activeSlots: 0,
      totalSlots: 0,
      utilization: 0,
      estimatedCriticalCycles: 0
    };
  }

  const cycles = mir.cycles.length;
  const activeSlots = mir.cycles.reduce((acc, cycle) => acc + cycle.slots.length, 0);
  const totalSlots = cycles * mir.grid.rows * mir.grid.cols;
  const utilization = totalSlots > 0 ? activeSlots / totalSlots : 0;

  return {
    cycles,
    instructions: activeSlots,
    activeSlots,
    totalSlots,
    utilization,
    estimatedCriticalCycles: cycles
  };
}

export function compile(source: string, options: CompileOptions = {}): CompileResult {
  const parseResult = parse(source, options);
  const diagnostics: Diagnostic[] = [...parseResult.diagnostics];
  const want = new Set(options.emitArtifacts ?? ['structured', 'ast', 'hir', 'mir', 'lir', 'csv']);
  const schedulerMode = inferSchedulerMode(parseResult.ast);
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
        activeSlots: 0,
        totalSlots: 0,
        utilization: 0,
        estimatedCriticalCycles: 0,
        schedulerMode,
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
        activeSlots: 0,
        totalSlots: 0,
        utilization: 0,
        estimatedCriticalCycles: parseResult.ast.kernel?.cycles.length ?? 0,
        schedulerMode,
        loweredPasses: []
      }
    };
  }

  const analysisAst = parseResult.ast;

  const analysis = analyze({
    ast: analysisAst,
    structuredAst: parseResult.structuredAst
  }, options);
  diagnostics.push(...analysis.diagnostics);

  let csv: string | undefined;
  if ((analysis.lir || analysis.mir) && want.has('csv')) {
    const emitted = emit(analysis.lir ?? analysis.mir!, { includeCycleHeader: true });
    diagnostics.push(...emitted.diagnostics);
    csv = emitted.csv;
  }

  const mirStats = computeMirStats(analysis.mir);
  const astCycleCount = analysis.ast?.kernel?.cycles.length ?? 0;

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
      cycles: analysis.mir ? mirStats.cycles : astCycleCount,
      instructions: analysis.mir ? mirStats.instructions : 0,
      activeSlots: analysis.mir ? mirStats.activeSlots : 0,
      totalSlots: analysis.mir ? mirStats.totalSlots : 0,
      utilization: analysis.mir ? mirStats.utilization : 0,
      estimatedCriticalCycles: analysis.mir ? mirStats.estimatedCriticalCycles : astCycleCount,
      schedulerMode,
      loweredPasses: analysis.loweredPasses
    }
  };
}
