/**
 * REPL Instruction Executor
 * 
 * Executes DSL instructions on the simulated CGRA state.
 * Supports ALU operations, memory operations, and routing.
 */

import {
  ReplState,
  getRegister,
  setRegister,
  readMemory,
  writeMemory,
  resolveDataAddress,
  declareData,
  incrementCycle,
  addHistory,
} from './state.js';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface ExecutionResult {
  success: boolean;
  message?: string;
  error?: string;
  value?: number;
  pe?: { row: number; col: number };
  register?: string;
}

interface ParsedInstruction {
  pe?: { row: number; col: number };
  opcode: string;
  operands: string[];
}

// ═══════════════════════════════════════════════════════════════════════════
// INSTRUCTION PARSER
// ═══════════════════════════════════════════════════════════════════════════

function parseInstruction(input: string): ParsedInstruction | null {
  const trimmed = input.trim();
  if (!trimmed || trimmed.startsWith('//')) return null;
  
  // Remove trailing semicolon
  const clean = trimmed.replace(/;$/, '').trim();
  
  // Check for PE prefix: @row,col:
  let pe: { row: number; col: number } | undefined;
  let rest = clean;
  
  const peMatch = clean.match(/^@(\d+),(\d+):\s*/);
  if (peMatch) {
    pe = { row: parseInt(peMatch[1]), col: parseInt(peMatch[2]) };
    rest = clean.slice(peMatch[0].length);
  }
  
  // Parse opcode and operands
  const parts = rest.split(/[\s,]+/).filter(p => p.length > 0);
  if (parts.length === 0) return null;
  
  const opcode = parts[0].toUpperCase();
  const operands = parts.slice(1);
  
  return { pe, opcode, operands };
}

function parseDataDeclaration(input: string): { name: string; address: number; values: number[] } | null {
  // .data name @ 0x100 = [1, 2, 3, 4]
  const match = input.match(/\.data\s+(\w+)\s*@\s*(0x[0-9a-fA-F]+|\d+)\s*=\s*\[([^\]]+)\]/i);
  if (!match) return null;
  
  const name = match[1];
  const address = match[2].startsWith('0x') ? parseInt(match[2], 16) : parseInt(match[2]);
  const values = match[3].split(',').map(v => parseInt(v.trim()));
  
  return { name, address, values };
}

function parseMemoryOperand(operand: string, state: ReplState): number | null {
  // Format: name[index] or direct address
  const match = operand.match(/(\w+)\[(\d+)\]/);
  if (match) {
    const name = match[1];
    const index = parseInt(match[2]);
    return resolveDataAddress(state, name, index);
  }
  
  // Direct hex address
  if (operand.startsWith('0x')) {
    return parseInt(operand, 16);
  }
  
  // Direct decimal address
  if (/^\d+$/.test(operand)) {
    return parseInt(operand);
  }
  
  return null;
}

function getRegisterValue(state: ReplState, pe: { row: number; col: number }, operand: string): number | null {
  const upper = operand.toUpperCase();
  
  // Immediate value
  if (/^-?\d+$/.test(operand)) {
    return parseInt(operand);
  }
  
  // Zero register
  if (upper === 'ZERO') return 0;
  
  // Regular register
  return getRegister(state, pe.row, pe.col, upper);
}

// ═══════════════════════════════════════════════════════════════════════════
// INSTRUCTION EXECUTION
// ═══════════════════════════════════════════════════════════════════════════

export function executeInstruction(state: ReplState, input: string): ExecutionResult {
  const trimmed = input.trim();
  
  // Handle .data declaration
  if (trimmed.toLowerCase().startsWith('.data')) {
    const decl = parseDataDeclaration(trimmed);
    if (!decl) {
      return { success: false, error: 'Invalid .data syntax. Use: .data name @ 0x100 = [1, 2, 3]' };
    }
    declareData(state, decl.name, decl.address, decl.values);
    addHistory(state, trimmed);
    return { 
      success: true, 
      message: `Declared ${decl.name} @ 0x${decl.address.toString(16)} = [${decl.values.join(', ')}]` 
    };
  }
  
  // Parse instruction
  const parsed = parseInstruction(trimmed);
  if (!parsed) {
    return { success: false, error: 'Could not parse instruction' };
  }
  
  // Default PE to 0,0 if not specified
  const pe = parsed.pe || { row: 0, col: 0 };
  
  // Validate PE coordinates
  if (pe.row < 0 || pe.row >= state.gridHeight || pe.col < 0 || pe.col >= state.gridWidth) {
    return { success: false, error: `Invalid PE coordinates: @${pe.row},${pe.col}` };
  }
  
  // Execute based on opcode
  const result = executeOpcode(state, pe, parsed.opcode, parsed.operands);
  
  if (result.success) {
    addHistory(state, trimmed);
  }
  
  return { ...result, pe };
}

function executeOpcode(
  state: ReplState, 
  pe: { row: number; col: number }, 
  opcode: string, 
  operands: string[]
): ExecutionResult {
  switch (opcode) {
    // ─────────────────────────────────────────────────────────────────────
    // LOAD OPERATIONS
    // ─────────────────────────────────────────────────────────────────────
    case 'LWI': {
      // LWI Rd, address
      if (operands.length < 2) {
        return { success: false, error: 'LWI requires: Rd, address' };
      }
      const rd = operands[0];
      const addr = parseMemoryOperand(operands[1], state);
      if (addr === null) {
        return { success: false, error: `Invalid memory address: ${operands[1]}` };
      }
      const value = readMemory(state, addr);
      setRegister(state, pe.row, pe.col, rd, value);
      return { 
        success: true, 
        message: `${rd} = mem[0x${addr.toString(16)}] = ${value}`,
        value,
        register: rd,
      };
    }
    
    case 'MOVI':
    case 'LI': {
      // MOVI Rd, imm
      if (operands.length < 2) {
        return { success: false, error: 'MOVI requires: Rd, immediate' };
      }
      const rd = operands[0];
      const imm = parseInt(operands[1]);
      if (isNaN(imm)) {
        return { success: false, error: `Invalid immediate value: ${operands[1]}` };
      }
      setRegister(state, pe.row, pe.col, rd, imm);
      return { 
        success: true, 
        message: `${rd} = ${imm}`,
        value: imm,
        register: rd,
      };
    }
    
    // ─────────────────────────────────────────────────────────────────────
    // STORE OPERATIONS
    // ─────────────────────────────────────────────────────────────────────
    case 'SWI': {
      // SWI Rs, address
      if (operands.length < 2) {
        return { success: false, error: 'SWI requires: Rs, address' };
      }
      const rs = operands[0];
      const addr = parseMemoryOperand(operands[1], state);
      if (addr === null) {
        return { success: false, error: `Invalid memory address: ${operands[1]}` };
      }
      const value = getRegisterValue(state, pe, rs);
      if (value === null) {
        return { success: false, error: `Invalid register: ${rs}` };
      }
      writeMemory(state, addr, value);
      return { 
        success: true, 
        message: `mem[0x${addr.toString(16)}] = ${rs} = ${value}`,
        value,
      };
    }
    
    // ─────────────────────────────────────────────────────────────────────
    // ALU OPERATIONS
    // ─────────────────────────────────────────────────────────────────────
    case 'ADD':
    case 'SADD': {
      // ADD Rd, Rs1, Rs2
      if (operands.length < 3) {
        return { success: false, error: 'ADD requires: Rd, Rs1, Rs2' };
      }
      const rd = operands[0];
      const v1 = getRegisterValue(state, pe, operands[1]);
      const v2 = getRegisterValue(state, pe, operands[2]);
      if (v1 === null || v2 === null) {
        return { success: false, error: 'Invalid register operand' };
      }
      const result = v1 + v2;
      setRegister(state, pe.row, pe.col, rd, result);
      return { 
        success: true, 
        message: `${rd} = ${v1} + ${v2} = ${result}`,
        value: result,
        register: rd,
      };
    }
    
    case 'SUB':
    case 'SSUB': {
      if (operands.length < 3) {
        return { success: false, error: 'SUB requires: Rd, Rs1, Rs2' };
      }
      const rd = operands[0];
      const v1 = getRegisterValue(state, pe, operands[1]);
      const v2 = getRegisterValue(state, pe, operands[2]);
      if (v1 === null || v2 === null) {
        return { success: false, error: 'Invalid register operand' };
      }
      const result = v1 - v2;
      setRegister(state, pe.row, pe.col, rd, result);
      return { 
        success: true, 
        message: `${rd} = ${v1} - ${v2} = ${result}`,
        value: result,
        register: rd,
      };
    }
    
    case 'MUL':
    case 'SMUL': {
      if (operands.length < 3) {
        return { success: false, error: 'MUL requires: Rd, Rs1, Rs2' };
      }
      const rd = operands[0];
      const v1 = getRegisterValue(state, pe, operands[1]);
      const v2 = getRegisterValue(state, pe, operands[2]);
      if (v1 === null || v2 === null) {
        return { success: false, error: 'Invalid register operand' };
      }
      const result = v1 * v2;
      setRegister(state, pe.row, pe.col, rd, result);
      return { 
        success: true, 
        message: `${rd} = ${v1} * ${v2} = ${result}`,
        value: result,
        register: rd,
      };
    }
    
    case 'AND': {
      if (operands.length < 3) {
        return { success: false, error: 'AND requires: Rd, Rs1, Rs2' };
      }
      const rd = operands[0];
      const v1 = getRegisterValue(state, pe, operands[1]);
      const v2 = getRegisterValue(state, pe, operands[2]);
      if (v1 === null || v2 === null) {
        return { success: false, error: 'Invalid register operand' };
      }
      const result = v1 & v2;
      setRegister(state, pe.row, pe.col, rd, result);
      return { 
        success: true, 
        message: `${rd} = ${v1} & ${v2} = ${result}`,
        value: result,
        register: rd,
      };
    }
    
    case 'OR': {
      if (operands.length < 3) {
        return { success: false, error: 'OR requires: Rd, Rs1, Rs2' };
      }
      const rd = operands[0];
      const v1 = getRegisterValue(state, pe, operands[1]);
      const v2 = getRegisterValue(state, pe, operands[2]);
      if (v1 === null || v2 === null) {
        return { success: false, error: 'Invalid register operand' };
      }
      const result = v1 | v2;
      setRegister(state, pe.row, pe.col, rd, result);
      return { 
        success: true, 
        message: `${rd} = ${v1} | ${v2} = ${result}`,
        value: result,
        register: rd,
      };
    }
    
    case 'XOR': {
      if (operands.length < 3) {
        return { success: false, error: 'XOR requires: Rd, Rs1, Rs2' };
      }
      const rd = operands[0];
      const v1 = getRegisterValue(state, pe, operands[1]);
      const v2 = getRegisterValue(state, pe, operands[2]);
      if (v1 === null || v2 === null) {
        return { success: false, error: 'Invalid register operand' };
      }
      const result = v1 ^ v2;
      setRegister(state, pe.row, pe.col, rd, result);
      return { 
        success: true, 
        message: `${rd} = ${v1} ^ ${v2} = ${result}`,
        value: result,
        register: rd,
      };
    }
    
    case 'SHL':
    case 'LSL': {
      if (operands.length < 3) {
        return { success: false, error: 'SHL requires: Rd, Rs1, Rs2/imm' };
      }
      const rd = operands[0];
      const v1 = getRegisterValue(state, pe, operands[1]);
      const v2 = getRegisterValue(state, pe, operands[2]);
      if (v1 === null || v2 === null) {
        return { success: false, error: 'Invalid register operand' };
      }
      const result = v1 << v2;
      setRegister(state, pe.row, pe.col, rd, result);
      return { 
        success: true, 
        message: `${rd} = ${v1} << ${v2} = ${result}`,
        value: result,
        register: rd,
      };
    }
    
    case 'SHR':
    case 'LSR': {
      if (operands.length < 3) {
        return { success: false, error: 'SHR requires: Rd, Rs1, Rs2/imm' };
      }
      const rd = operands[0];
      const v1 = getRegisterValue(state, pe, operands[1]);
      const v2 = getRegisterValue(state, pe, operands[2]);
      if (v1 === null || v2 === null) {
        return { success: false, error: 'Invalid register operand' };
      }
      const result = v1 >>> v2;
      setRegister(state, pe.row, pe.col, rd, result);
      return { 
        success: true, 
        message: `${rd} = ${v1} >>> ${v2} = ${result}`,
        value: result,
        register: rd,
      };
    }
    
    case 'MOV': {
      // MOV Rd, Rs
      if (operands.length < 2) {
        return { success: false, error: 'MOV requires: Rd, Rs' };
      }
      const rd = operands[0];
      const value = getRegisterValue(state, pe, operands[1]);
      if (value === null) {
        return { success: false, error: `Invalid source: ${operands[1]}` };
      }
      setRegister(state, pe.row, pe.col, rd, value);
      return { 
        success: true, 
        message: `${rd} = ${value}`,
        value,
        register: rd,
      };
    }
    
    case 'NOP': {
      return { success: true, message: 'No operation' };
    }
    
    case 'PASS': {
      // PASS Rd, Rs - pass through
      if (operands.length < 2) {
        return { success: false, error: 'PASS requires: Rd, Rs' };
      }
      const rd = operands[0];
      const value = getRegisterValue(state, pe, operands[1]);
      if (value === null) {
        return { success: false, error: `Invalid source: ${operands[1]}` };
      }
      setRegister(state, pe.row, pe.col, rd, value);
      return { 
        success: true, 
        message: `${rd} = ${value} (pass)`,
        value,
        register: rd,
      };
    }
    
    default:
      return { success: false, error: `Unknown opcode: ${opcode}` };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// BATCH EXECUTION
// ═══════════════════════════════════════════════════════════════════════════

export function executeCycle(state: ReplState, instructions: string[]): ExecutionResult[] {
  const results: ExecutionResult[] = [];
  
  for (const inst of instructions) {
    const trimmed = inst.trim();
    if (!trimmed || trimmed.startsWith('//')) continue;
    
    const result = executeInstruction(state, trimmed);
    results.push(result);
  }
  
  incrementCycle(state);
  return results;
}
