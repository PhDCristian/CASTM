/**
 * OpenEdge-DSL Instruction Emitter
 *
 * Formats instructions for CSV output in the CGRA simulator format.
 */

import { Instruction, CycleBlock } from '../types/ast';
import { SymbolTable } from '../types/symbols';
import { resolveOperand, buildDataIndexMap } from '../semantic/symbol-resolver';

/**
 * Default grid dimensions
 */
export const DEFAULT_GRID_ROWS = 4;
export const DEFAULT_GRID_COLS = 4;

/**
 * Formats an instruction for CSV output
 */
export function formatInstruction(
  instruction: Instruction,
  symbols: SymbolTable,
  dataIndexToAddress: number[]
): string {
  const { opcode, operands } = instruction;

  // NOP and EXIT have no operands
  if (opcode === 'NOP' || opcode === 'EXIT') {
    return opcode;
  }

  // Resolve all operands
  const resolvedOperands = operands.map(op => {
    const result = resolveOperand(op, symbols, dataIndexToAddress);
    return result.value;
  });

  // Format: "OPCODE OP1, OP2, OP3"
  // Quotes needed because of commas in CSV
  return `"${opcode} ${resolvedOperands.join(', ')}"`;
}

/**
 * Formats a row of instructions for CSV output
 */
export function formatRow(
  cycleInstructions: Map<string, Instruction>,
  row: number,
  cols: number,
  symbols: SymbolTable,
  dataIndexToAddress: number[]
): string {
  const rowInstructions: string[] = [];

  for (let col = 0; col < cols; col++) {
    const key = `${row},${col}`;
    let instrString = 'NOP';

    if (cycleInstructions.has(key)) {
      const instr = cycleInstructions.get(key)!;
      instrString = formatInstruction(instr, symbols, dataIndexToAddress);
    }

    rowInstructions.push(instrString);
  }

  return rowInstructions.join(', ');
}

/**
 * Formats a complete cycle block for CSV output
 */
export function formatCycleBlock(
  cycle: CycleBlock,
  rows: number,
  cols: number,
  symbols: SymbolTable,
  dataIndexToAddress: number[]
): string[] {
  const lines: string[] = [];

  // Output cycle number
  lines.push(cycle.cycleNumber.toString());

  // Output each row
  for (let row = 0; row < rows; row++) {
    lines.push(formatRow(
      cycle.instructions,
      row,
      cols,
      symbols,
      dataIndexToAddress
    ));
  }

  return lines;
}

/**
 * Checks if a cycle contains an EXIT instruction
 */
export function hasExitInstruction(cycle: CycleBlock): boolean {
  for (const instr of cycle.instructions.values()) {
    if (instr.opcode === 'EXIT') {
      return true;
    }
  }
  return false;
}

/**
 * Creates an implicit EXIT cycle
 */
export function createExitCycle(cycleNumber: number): CycleBlock {
  return {
    cycleNumber,
    instructions: new Map([['0,0', { opcode: 'EXIT', operands: [], originalLine: 0 }]])
  };
}

/**
 * Generates a PE coordinate key
 */
export function makeCoordKey(row: number, col: number): string {
  return `${row},${col}`;
}

/**
 * Parses a PE coordinate key
 */
export function parseCoordKey(key: string): { row: number; col: number } {
  const [row, col] = key.split(',').map(Number);
  return { row, col };
}

/**
 * Creates an instruction with given opcode and operands
 */
export function makeInstruction(
  opcode: string,
  operands: string[],
  line: number = 0
): Instruction {
  return { opcode, operands, originalLine: line };
}

/**
 * Creates a NOP instruction
 */
export function makeNop(line: number = 0): Instruction {
  return { opcode: 'NOP', operands: [], originalLine: line };
}

/**
 * Creates an EXIT instruction
 */
export function makeExit(line: number = 0): Instruction {
  return { opcode: 'EXIT', operands: [], originalLine: line };
}
