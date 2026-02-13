import { Diagnostic } from './common.js';
import { AstProgram, StructuredProgramAst } from './ast.js';
import { HirProgram } from './hir.js';
import { MirProgram } from './mir.js';
import { LirProgram } from './lir.js';
import { AssertionInfo, IoConfigInfo, MemoryRegionInfo, SymbolInfo } from './runtime.js';

export interface ParseResult {
  success: boolean;
  structuredAst?: StructuredProgramAst;
  ast?: AstProgram;
  diagnostics: Diagnostic[];
}

export interface AnalysisResult {
  success: boolean;
  diagnostics: Diagnostic[];
  structuredAst?: StructuredProgramAst;
  ast?: AstProgram;
  hir?: HirProgram;
  mir?: MirProgram;
  lir?: LirProgram;
  memoryRegions?: MemoryRegionInfo[];
  ioConfig?: IoConfigInfo;
  cycleLimit?: number;
  assertions?: AssertionInfo[];
  symbols?: SymbolInfo;
  loweredPasses: string[];
}

export interface CompileResult {
  success: boolean;
  diagnostics: Diagnostic[];
  artifacts: {
    csv?: string;
    structuredAst?: StructuredProgramAst;
    ast?: AstProgram;
    hir?: HirProgram;
    mir?: MirProgram;
    lir?: LirProgram;
    memoryRegions?: MemoryRegionInfo[];
    ioConfig?: IoConfigInfo;
    cycleLimit?: number;
    assertions?: AssertionInfo[];
    symbols?: SymbolInfo;
  };
  stats: {
    cycles: number;
    instructions: number;
    activeSlots: number;
    totalSlots: number;
    utilization: number;
    estimatedCriticalCycles: number;
    schedulerMode: 'safe' | 'balanced' | 'aggressive';
    loweredPasses: string[];
  };
}

export interface EmitResult {
  success: boolean;
  diagnostics: Diagnostic[];
  csv?: string;
}
