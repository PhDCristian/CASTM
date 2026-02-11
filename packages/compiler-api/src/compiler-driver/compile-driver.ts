import {
  CompileOptions,
  CompileResult,
  Diagnostic,
  StructuredKernelStmtAst,
  StructuredProgramAst
} from '@openedge/compiler-ir';
import { lowerStructuredProgramToAst } from '@openedge/compiler-front';
import {
  collectRuntimeArtifacts,
  createEmptyRuntimeArtifacts
} from './runtime-artifacts.js';
import { hasErrors } from './utils.js';
import { analyze } from './analyze-driver.js';
import { emit } from './emit-driver.js';
import { parse } from './parse-driver.js';

function containsFunctionCalls(stmts: StructuredKernelStmtAst[]): boolean {
  for (const stmt of stmts) {
    if (stmt.kind === 'fn-call') return true;
    if (stmt.kind === 'for' && containsFunctionCalls(stmt.body)) return true;
    if (stmt.kind === 'if') {
      if (containsFunctionCalls(stmt.thenBody)) return true;
      if (stmt.elseBody && containsFunctionCalls(stmt.elseBody)) return true;
    }
    if (stmt.kind === 'while' && containsFunctionCalls(stmt.body)) return true;
  }
  return false;
}

function canLowerStructuredDirectly(structured: StructuredProgramAst | undefined): boolean {
  const body = structured?.kernel?.body;
  if (!body) return false;
  return !containsFunctionCalls(body);
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

  const analysisAst = parseResult.structuredAst && canLowerStructuredDirectly(parseResult.structuredAst)
    ? lowerStructuredProgramToAst(parseResult.structuredAst)
    : parseResult.ast;

  const analysis = analyze({
    ast: analysisAst,
    structuredAst: parseResult.structuredAst
  }, {
    ...options,
    targetProfile: options.targetProfile ?? analysisAst.targetProfileId ?? undefined
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
