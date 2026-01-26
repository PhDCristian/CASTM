/**
 * OpenEdge-DSL CSV Generator
 *
 * Generates CSV output from the AST for the CGRA simulator.
 */

import { KernelAst, CycleBlock } from '../types/ast';
import { SymbolTable } from '../types/symbols';
import { buildDataIndexMap } from '../semantic/symbol-resolver';
import {
  formatCycleBlock,
  hasExitInstruction,
  createExitCycle,
  DEFAULT_GRID_ROWS,
  DEFAULT_GRID_COLS
} from './instruction-emitter';

/**
 * Options for CSV generation
 */
export interface CsvGeneratorOptions {
  /** Number of rows in the grid (default: 4) */
  rows?: number;
  /** Number of columns in the grid (default: 4) */
  cols?: number;
  /** Whether to add implicit EXIT if none present (default: true) */
  addImplicitExit?: boolean;
}

/**
 * Result of CSV generation
 */
export interface CsvGeneratorResult {
  /** The generated CSV string */
  csv: string;
  /** Number of cycles generated */
  cycleCount: number;
  /** Whether an implicit EXIT was added */
  implicitExitAdded: boolean;
}

/**
 * Generates CSV from the AST
 */
export function generateCsv(
  ast: KernelAst,
  symbols: SymbolTable,
  options: CsvGeneratorOptions = {}
): CsvGeneratorResult {
  const {
    rows = DEFAULT_GRID_ROWS,
    cols = DEFAULT_GRID_COLS,
    addImplicitExit = true
  } = options;

  // Build data index to address mapping
  const dataIndexToAddress = buildDataIndexMap(ast.memoryInit);

  // Check for EXIT instruction
  let hasExit = ast.cycles.some(hasExitInstruction);
  let implicitExitAdded = false;

  // Create working copy of cycles
  const cycles = [...ast.cycles];

  // Add implicit EXIT if needed
  if (!hasExit && addImplicitExit) {
    const lastCycleNum = cycles.length > 0
      ? Math.max(...cycles.map(c => c.cycleNumber))
      : -1;

    cycles.push(createExitCycle(lastCycleNum + 1));
    implicitExitAdded = true;
  }

  // Sort cycles by cycle number
  const sortedCycles = cycles.sort((a, b) => a.cycleNumber - b.cycleNumber);

  // Generate CSV lines
  const lines: string[] = [];

  for (const cycle of sortedCycles) {
    const cycleLines = formatCycleBlock(
      cycle,
      rows,
      cols,
      symbols,
      dataIndexToAddress
    );
    lines.push(...cycleLines);
  }

  return {
    csv: lines.join('\n'),
    cycleCount: sortedCycles.length,
    implicitExitAdded
  };
}

/**
 * Validates that all cycles have sequential numbering
 */
export function validateCycleSequence(cycles: CycleBlock[]): string | null {
  if (cycles.length === 0) {
    return null;
  }

  const sorted = [...cycles].sort((a, b) => a.cycleNumber - b.cycleNumber);

  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i].cycleNumber;
    const next = sorted[i + 1].cycleNumber;

    // Allow gaps (they'll be filled with NOPs by simulator)
    // But warn about duplicates
    if (current === next) {
      return `Duplicate cycle number: ${current}`;
    }
  }

  return null;
}

/**
 * Gets the maximum cycle number in the AST
 */
export function getMaxCycleNumber(cycles: CycleBlock[]): number {
  if (cycles.length === 0) {
    return -1;
  }
  return Math.max(...cycles.map(c => c.cycleNumber));
}

/**
 * Gets the minimum cycle number in the AST
 */
export function getMinCycleNumber(cycles: CycleBlock[]): number {
  if (cycles.length === 0) {
    return 0;
  }
  return Math.min(...cycles.map(c => c.cycleNumber));
}

/**
 * Renumbers cycles to be sequential starting from 0
 */
export function renumberCycles(cycles: CycleBlock[]): CycleBlock[] {
  const sorted = [...cycles].sort((a, b) => a.cycleNumber - b.cycleNumber);

  return sorted.map((cycle, index) => ({
    ...cycle,
    cycleNumber: index
  }));
}

/**
 * Merges instructions from multiple cycles at the same cycle number
 */
export function mergeCycles(cycles: CycleBlock[]): CycleBlock[] {
  const cycleMap = new Map<number, CycleBlock>();

  for (const cycle of cycles) {
    const existing = cycleMap.get(cycle.cycleNumber);
    if (existing) {
      // Merge instructions (later ones override)
      for (const [key, instr] of cycle.instructions) {
        existing.instructions.set(key, instr);
      }
      // Keep label if present
      if (cycle.label && !existing.label) {
        existing.label = cycle.label;
      }
    } else {
      // Clone the cycle
      cycleMap.set(cycle.cycleNumber, {
        ...cycle,
        instructions: new Map(cycle.instructions)
      });
    }
  }

  return Array.from(cycleMap.values());
}
