/**
 * Knowledge Base for OpenEdge DSL Instructions
 */

export interface InstructionDef {
  opcode: string;
  name: string;
  description: string;
  cycles: number;
  operands: string[];
  example: string;
  category: 'ALU' | 'Memory' | 'Control' | 'System';
}

export const INSTRUCTION_DB: Record<string, InstructionDef> = {
  // Memory
  'LWI': {
    opcode: 'LWI',
    name: 'Load Word Immediate',
    description: 'Loads a 32-bit word from data memory into a register.',
    cycles: 1,
    operands: ['Rd', 'Addr'],
    example: 'LWI R0, input[0]',
    category: 'Memory'
  },
  'SWI': {
    opcode: 'SWI',
    name: 'Store Word Immediate',
    description: 'Stores a 32-bit word from a register into data memory.',
    cycles: 1,
    operands: ['Rs', 'Addr'],
    example: 'SWI R1, output[0]',
    category: 'Memory'
  },
  
  // ALU Arithmetic
  'ADD': {
    opcode: 'ADD',
    name: 'Add',
    description: 'Adds two registers and stores the result.',
    cycles: 1,
    operands: ['Rd', 'Rs1', 'Rs2'],
    example: 'ADD R0, R1, R2',
    category: 'ALU'
  },
  'SUB': {
    opcode: 'SUB',
    name: 'Subtract',
    description: 'Subtracts Rs2 from Rs1 and stores the result.',
    cycles: 1,
    operands: ['Rd', 'Rs1', 'Rs2'],
    example: 'SUB R0, R1, R2',
    category: 'ALU'
  },
  'MUL': {
    opcode: 'MUL',
    name: 'Multiply',
    description: 'Multiplies two registers. Result is lower 32 bits.',
    cycles: 2,
    operands: ['Rd', 'Rs1', 'Rs2'],
    example: 'MUL R0, R1, R2',
    category: 'ALU'
  },
  'SADD': {
    opcode: 'SADD',
    name: 'Signed Add',
    description: 'Signed addition of two registers.',
    cycles: 1,
    operands: ['Rd', 'Rs1', 'Rs2'],
    example: 'SADD R0, R1, R2',
    category: 'ALU'
  },
  'SSUB': {
    opcode: 'SSUB',
    name: 'Signed Subtract',
    description: 'Signed subtraction of two registers.',
    cycles: 1,
    operands: ['Rd', 'Rs1', 'Rs2'],
    example: 'SSUB R0, R1, R2',
    category: 'ALU'
  },
  'SMUL': {
    opcode: 'SMUL',
    name: 'Signed Multiply',
    description: 'Signed multiplication of two registers.',
    cycles: 2,
    operands: ['Rd', 'Rs1', 'Rs2'],
    example: 'SMUL R0, R1, R2',
    category: 'ALU'
  },
  
  // ALU Logic
  'AND': {
    opcode: 'AND',
    name: 'Bitwise AND',
    description: 'Bitwise AND operation.',
    cycles: 1,
    operands: ['Rd', 'Rs1', 'Rs2'],
    example: 'AND R0, R1, R2',
    category: 'ALU'
  },
  'OR': {
    opcode: 'OR',
    name: 'Bitwise OR',
    description: 'Bitwise OR operation.',
    cycles: 1,
    operands: ['Rd', 'Rs1', 'Rs2'],
    example: 'OR R0, R1, R2',
    category: 'ALU'
  },
  'XOR': {
    opcode: 'XOR',
    name: 'Bitwise XOR',
    description: 'Bitwise XOR operation.',
    cycles: 1,
    operands: ['Rd', 'Rs1', 'Rs2'],
    example: 'XOR R0, R1, R2',
    category: 'ALU'
  },
  
  // Control
  'NOP': {
    opcode: 'NOP',
    name: 'No Operation',
    description: 'Performs no operation for one cycle.',
    cycles: 1,
    operands: [],
    example: 'NOP',
    category: 'Control'
  },
  'EXIT': {
    opcode: 'EXIT',
    name: 'Exit Program',
    description: 'Terminates execution of the kernel.',
    cycles: 1,
    operands: [],
    example: 'EXIT',
    category: 'Control'
  },
  
  // Pragmas / System (Virtual instructions for help)
  '#PRAGMA': {
    opcode: '#PRAGMA',
    name: 'Compiler Directive',
    description: 'Special instruction for the compiler (unroll, parallel, etc).',
    cycles: 0,
    operands: ['Directive', 'Args...'],
    example: '#pragma unroll(2)',
    category: 'System'
  }
};

export function getInstructionInfo(line: string): InstructionDef | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('.')) return null;
  
  // Check for pragma
  if (trimmed.startsWith('#pragma')) return INSTRUCTION_DB['#PRAGMA'];
  
  // Extract opcode (assuming "OPCODE ..." or "LABEL: OPCODE ...")
  // Remove label if present
  let cleanLine = trimmed;
  if (cleanLine.includes(':')) {
    cleanLine = cleanLine.split(':')[1].trim();
  }
  
  const parts = cleanLine.split(/\s+/);
  if (parts.length === 0) return null;
  
  const opcode = parts[0].toUpperCase();
  return INSTRUCTION_DB[opcode] || null;
}
