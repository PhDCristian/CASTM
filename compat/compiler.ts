import {
  compile,
  type CompileOptions,
  type CompileResult,
  type Diagnostic,
  type MirProgram
} from '@openedge/compiler-api';
import type { Assertion } from './index.js';

export interface MemoryRegionInfo {
  start: number;
  values: number[];
  name?: string;
}

export interface CompilationResult {
  success: boolean;
  csv?: string;
  error?: string;
  line?: number;
  memoryInit?: Map<number, number[]>;
  memoryRegions?: MemoryRegionInfo[];
  ioConfig?: {
    loadAddrs: number[];
    storeAddrs: number[];
  };
  assertions?: Assertion[];
  maxCycles?: number;
  suggestedGridSize?: {
    width: number;
    height: number;
  };
}

function ensureTargetDeclaration(source: string, targetProfile: string): string {
  if (/^\s*target\s+"[^"]+"\s*;?/im.test(source)) {
    return source;
  }
  return `target "${targetProfile}";\n${source}`;
}

function quoteCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function formatInstruction(opcode: string, operands: string[]): string {
  if (!operands.length) return opcode;
  return `${opcode} ${operands.join(', ')}`;
}

function mirToLegacyCsv(mir: MirProgram): string {
  const rows = mir.grid.rows;
  const cols = mir.grid.cols;
  const lines: string[] = [];

  const cycles = [...mir.cycles].sort((a, b) => a.index - b.index);
  for (const cycle of cycles) {
    lines.push(String(cycle.index));

    const grid = Array.from({ length: rows }, () => Array.from({ length: cols }, () => 'NOP'));
    for (const slot of cycle.slots) {
      if (slot.row < 0 || slot.row >= rows || slot.col < 0 || slot.col >= cols) {
        continue;
      }
      grid[slot.row][slot.col] = formatInstruction(slot.instruction.opcode, slot.instruction.operands);
    }

    for (let row = 0; row < rows; row++) {
      lines.push(grid[row].map(quoteCell).join(', '));
    }
  }

  return lines.join('\n');
}

function firstErrorDiagnostic(diagnostics: Diagnostic[]): Diagnostic | undefined {
  return diagnostics.find((d) => d.severity === 'error');
}

function diagnosticToError(result: CompileResult): CompilationResult {
  const first = firstErrorDiagnostic(result.diagnostics);
  if (!first) {
    return {
      success: false,
      error: 'Compiler failed with unknown diagnostics.'
    };
  }

  return {
    success: false,
    error: `[${first.code}] ${first.message}`,
    line: first.span.startLine
  };
}

export function compileDslToCsv(
  dslCode: string,
  options: {
    targetProfile?: string;
    grid?: {
      rows?: number;
      cols?: number;
      topology?: 'torus' | 'mesh';
    };
  } = {}
): CompilationResult {
  const targetProfile = options.targetProfile ?? 'uma-cgra-v1';
  const source = ensureTargetDeclaration(dslCode, targetProfile);

  const result = compile(source, {
    targetProfile,
    grid: options.grid,
    emitArtifacts: ['mir']
  } as CompileOptions);

  if (!result.success) {
    return diagnosticToError(result);
  }

  if (!result.artifacts.mir) {
    return {
      success: false,
      error: 'Compiler did not produce MIR artifact.'
    };
  }

  const memoryRegions = (result.artifacts.memoryRegions ?? []).map((region) => ({
    start: region.start,
    values: region.values,
    name: region.name
  }));

  return {
    success: true,
    csv: mirToLegacyCsv(result.artifacts.mir),
    memoryInit: new Map(memoryRegions.map((region) => [region.start, region.values])),
    memoryRegions,
    ioConfig: result.artifacts.ioConfig,
    assertions: (result.artifacts.assertions ?? []).map((assertion) => ({
      cycle: assertion.cycle ?? 0,
      row: assertion.row ?? 0,
      col: assertion.col ?? 0,
      register: assertion.register ?? 'R0',
      value: assertion.value ?? 0
    })),
    maxCycles: result.stats.cycles,
    suggestedGridSize: {
      width: result.artifacts.mir.grid.cols,
      height: result.artifacts.mir.grid.rows
    }
  };
}
