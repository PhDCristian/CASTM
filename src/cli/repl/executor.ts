/**
 * REPL Instruction Executor
 * 
 * Executes DSL instructions on the simulated CGRA state.
 * Based on OpenEdgeCGRA-ISA v2.0.1:
 * 
 * Opcodes:
 * - Type 0: NOP (0), EXIT (25)
 * - Type 1: SADD, SSUB, SMUL, FXPMUL, SLL, SRL, SRA, LAND, LOR, LXOR, LNAND, LNOR, LXNOR
 * - Type 2: BSFA (14), BZFA (15) - Conditional selection
 * - Type 3: BEQ, BNE, BLT, BGE - Conditional branches
 * - Type 4: JUMP (20)
 * - Type 5: LWD (21), SWD (22) - Direct memory (streaming)
 * - Type 6: LWI (23), SWI (24) - Indirect memory (scatter/gather)
 * 
 * Operand sources (MUXA/MUXB):
 * 0=ZERO, 1=SELF, 2=RCL, 3=RCR, 4=RCT, 5=RCB, 6=R0, 7=R1, 8=R2, 9=R3, 10=IMM
 */

import {
  ReplState,
  PE,
  getRegister,
  setRegister,
  readMemory,
  writeMemory,
  resolveDataAddress,
  declareData,
  incrementCycle,
  addHistory,
  getPE,
  getNeighborROUT,
  updateFlags,
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

// Get operand value based on ISA operand sources
function getOperandValue(state: ReplState, pe: { row: number; col: number }, operand: string): number | null {
  const upper = operand.toUpperCase();
  
  // Immediate value (decimal or hex)
  if (/^-?\d+$/.test(operand)) {
    return parseInt(operand);
  }
  if (/^0x[0-9a-fA-F]+$/i.test(operand)) {
    return parseInt(operand, 16);
  }
  
  // ISA operand sources
  switch (upper) {
    case 'ZERO': return 0;
    case 'SELF': return getNeighborROUT(state, pe.row, pe.col, 'SELF');
    case 'RCL':  return getNeighborROUT(state, pe.row, pe.col, 'RCL');
    case 'RCR':  return getNeighborROUT(state, pe.row, pe.col, 'RCR');
    case 'RCT':  return getNeighborROUT(state, pe.row, pe.col, 'RCT');
    case 'RCB':  return getNeighborROUT(state, pe.row, pe.col, 'RCB');
    case 'R0':
    case 'R1':
    case 'R2':
    case 'R3':
    case 'ROUT':
      return getRegister(state, pe.row, pe.col, upper);
    default:
      return null;
  }
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
  const peObj = getPE(state, pe.row, pe.col)!;
  
  switch (opcode) {
    // ─────────────────────────────────────────────────────────────────────
    // TYPE 0: CONTROL
    // ─────────────────────────────────────────────────────────────────────
    case 'NOP': {
      // ROUT maintains value, no operation
      return { success: true, message: 'No operation (ROUT unchanged)' };
    }
    
    case 'EXIT': {
      return { success: true, message: 'Kernel exit signaled' };
    }
    
    // ─────────────────────────────────────────────────────────────────────
    // TYPE 1: ARITHMETIC-LOGIC (SADD, SSUB, SMUL, etc.)
    // Format: OP [Rd,] Rs1, Rs2   (Rd is optional, result always goes to ROUT)
    // ─────────────────────────────────────────────────────────────────────
    case 'SADD':
    case 'ADD': {
      const { rd, v1, v2, err } = parseAluOperands(state, pe, operands);
      if (err) return { success: false, error: err };
      
      const result = (v1! + v2!) | 0;  // 32-bit signed
      return writeAluResult(state, pe, peObj, rd, result, `${v1} + ${v2} = ${result}`);
    }
    
    case 'SSUB':
    case 'SUB': {
      const { rd, v1, v2, err } = parseAluOperands(state, pe, operands);
      if (err) return { success: false, error: err };
      
      const result = (v1! - v2!) | 0;
      return writeAluResult(state, pe, peObj, rd, result, `${v1} - ${v2} = ${result}`);
    }
    
    case 'SMUL':
    case 'MUL': {
      const { rd, v1, v2, err } = parseAluOperands(state, pe, operands);
      if (err) return { success: false, error: err };
      
      const result = Math.imul(v1!, v2!);  // 32-bit signed multiply
      return writeAluResult(state, pe, peObj, rd, result, `${v1} * ${v2} = ${result}`);
    }
    
    case 'FXPMUL': {
      // Fixed-point multiply Q1.16.15
      const { rd, v1, v2, err } = parseAluOperands(state, pe, operands);
      if (err) return { success: false, error: err };
      
      const fullResult = BigInt(v1!) * BigInt(v2!);
      const result = Number((fullResult >> 15n) & 0xFFFFFFFFn) | 0;
      return writeAluResult(state, pe, peObj, rd, result, `fxp(${v1} * ${v2}) = ${result}`);
    }
    
    case 'SLL':
    case 'SLT': {
      const { rd, v1, v2, err } = parseAluOperands(state, pe, operands);
      if (err) return { success: false, error: err };
      
      const shamt = v2! & 0x1F;  // Only lower 5 bits
      const result = (v1! << shamt) | 0;
      return writeAluResult(state, pe, peObj, rd, result, `${v1} << ${shamt} = ${result}`);
    }
    
    case 'SRL':
    case 'SRT': {
      const { rd, v1, v2, err } = parseAluOperands(state, pe, operands);
      if (err) return { success: false, error: err };
      
      const shamt = v2! & 0x1F;
      const result = v1! >>> shamt;  // Logical right shift
      return writeAluResult(state, pe, peObj, rd, result, `${v1} >>> ${shamt} = ${result}`);
    }
    
    case 'SRA': {
      const { rd, v1, v2, err } = parseAluOperands(state, pe, operands);
      if (err) return { success: false, error: err };
      
      const shamt = v2! & 0x1F;
      const result = v1! >> shamt;  // Arithmetic right shift
      return writeAluResult(state, pe, peObj, rd, result, `${v1} >> ${shamt} = ${result}`);
    }
    
    case 'LAND':
    case 'AND': {
      const { rd, v1, v2, err } = parseAluOperands(state, pe, operands);
      if (err) return { success: false, error: err };
      
      const result = v1! & v2!;
      return writeAluResult(state, pe, peObj, rd, result, `${v1} & ${v2} = ${result}`);
    }
    
    case 'LOR':
    case 'OR': {
      const { rd, v1, v2, err } = parseAluOperands(state, pe, operands);
      if (err) return { success: false, error: err };
      
      const result = v1! | v2!;
      return writeAluResult(state, pe, peObj, rd, result, `${v1} | ${v2} = ${result}`);
    }
    
    case 'LXOR':
    case 'XOR': {
      const { rd, v1, v2, err } = parseAluOperands(state, pe, operands);
      if (err) return { success: false, error: err };
      
      const result = v1! ^ v2!;
      return writeAluResult(state, pe, peObj, rd, result, `${v1} ^ ${v2} = ${result}`);
    }
    
    case 'LNAND': {
      const { rd, v1, v2, err } = parseAluOperands(state, pe, operands);
      if (err) return { success: false, error: err };
      
      const result = ~(v1! & v2!);
      return writeAluResult(state, pe, peObj, rd, result, `~(${v1} & ${v2}) = ${result}`);
    }
    
    case 'LNOR': {
      const { rd, v1, v2, err } = parseAluOperands(state, pe, operands);
      if (err) return { success: false, error: err };
      
      const result = ~(v1! | v2!);
      return writeAluResult(state, pe, peObj, rd, result, `~(${v1} | ${v2}) = ${result}`);
    }
    
    case 'LXNOR': {
      const { rd, v1, v2, err } = parseAluOperands(state, pe, operands);
      if (err) return { success: false, error: err };
      
      const result = ~(v1! ^ v2!);
      return writeAluResult(state, pe, peObj, rd, result, `~(${v1} ^ ${v2}) = ${result}`);
    }
    
    // ─────────────────────────────────────────────────────────────────────
    // TYPE 2: CONDITIONAL SELECTION (BSFA, BZFA)
    // Format: OP Rd, RsA, RsB [, flag_src]
    // ─────────────────────────────────────────────────────────────────────
    case 'BSFA': {
      // rd = sign_flag ? rsA : rsB
      if (operands.length < 3) {
        return { success: false, error: 'BSFA requires: Rd, RsA, RsB [, flag_src]' };
      }
      const rd = operands[0];
      const vA = getOperandValue(state, pe, operands[1]);
      const vB = getOperandValue(state, pe, operands[2]);
      if (vA === null || vB === null) {
        return { success: false, error: 'Invalid operand' };
      }
      
      // TODO: Support flag_src from neighbors. For now use own flags.
      const result = peObj.flags.sign ? vA : vB;
      return writeAluResult(state, pe, peObj, rd, result, 
        `sign=${peObj.flags.sign ? 1 : 0} ? ${vA} : ${vB} = ${result}`);
    }
    
    case 'BZFA': {
      // rd = zero_flag ? rsA : rsB
      if (operands.length < 3) {
        return { success: false, error: 'BZFA requires: Rd, RsA, RsB [, flag_src]' };
      }
      const rd = operands[0];
      const vA = getOperandValue(state, pe, operands[1]);
      const vB = getOperandValue(state, pe, operands[2]);
      if (vA === null || vB === null) {
        return { success: false, error: 'Invalid operand' };
      }
      
      const result = peObj.flags.zero ? vA : vB;
      return writeAluResult(state, pe, peObj, rd, result,
        `zero=${peObj.flags.zero ? 1 : 0} ? ${vA} : ${vB} = ${result}`);
    }
    
    // ─────────────────────────────────────────────────────────────────────
    // TYPE 6: INDIRECT MEMORY (LWI, SWI)
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
      
      // LWI: result goes to ROUT and optionally to Rd
      peObj.registers.ROUT = value;
      updateFlags(peObj, value);
      if (rd.toUpperCase() !== 'ROUT') {
        setRegister(state, pe.row, pe.col, rd, value);
      }
      peObj.lastModified = rd.toUpperCase();
      
      return { 
        success: true, 
        message: `${rd} = mem[0x${addr.toString(16)}] = ${value}`,
        value,
        register: rd,
      };
    }
    
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
      const value = getOperandValue(state, pe, rs);
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
    // CONVENIENCE: MOVI (load immediate - not in ISA but useful for REPL)
    // ─────────────────────────────────────────────────────────────────────
    case 'MOVI':
    case 'LI': {
      // MOVI Rd, imm  ->  SADD Rd, ZERO, IMM
      if (operands.length < 2) {
        return { success: false, error: 'MOVI requires: Rd, immediate' };
      }
      const rd = operands[0];
      const imm = parseInt(operands[1]);
      if (isNaN(imm)) {
        return { success: false, error: `Invalid immediate value: ${operands[1]}` };
      }
      return writeAluResult(state, pe, peObj, rd, imm, `${rd} = ${imm}`);
    }
    
    case 'MOV': {
      // MOV Rd, Rs  ->  SADD Rd, Rs, ZERO
      if (operands.length < 2) {
        return { success: false, error: 'MOV requires: Rd, Rs' };
      }
      const rd = operands[0];
      const value = getOperandValue(state, pe, operands[1]);
      if (value === null) {
        return { success: false, error: `Invalid source: ${operands[1]}` };
      }
      return writeAluResult(state, pe, peObj, rd, value, `${rd} = ${value}`);
    }
    
    case 'PASS': {
      // PASS Rd, Rs - pass through (alias for MOV)
      if (operands.length < 2) {
        return { success: false, error: 'PASS requires: Rd, Rs' };
      }
      const rd = operands[0];
      const value = getOperandValue(state, pe, operands[1]);
      if (value === null) {
        return { success: false, error: `Invalid source: ${operands[1]}` };
      }
      return writeAluResult(state, pe, peObj, rd, value, `${rd} = ${value} (pass)`);
    }
    
    default:
      return { success: false, error: `Unknown opcode: ${opcode}` };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

// Parse ALU operands: supports both "Rd, Rs1, Rs2" and "Rs1, Rs2" formats
function parseAluOperands(
  state: ReplState, 
  pe: { row: number; col: number }, 
  operands: string[]
): { rd?: string; v1?: number; v2?: number; err?: string } {
  if (operands.length < 2) {
    return { err: 'ALU operation requires at least 2 operands' };
  }
  
  let rd: string | undefined;
  let op1: string;
  let op2: string;
  
  if (operands.length >= 3) {
    // Format: Rd, Rs1, Rs2
    rd = operands[0];
    op1 = operands[1];
    op2 = operands[2];
  } else {
    // Format: Rs1, Rs2 (result only to ROUT)
    op1 = operands[0];
    op2 = operands[1];
  }
  
  const v1 = getOperandValue(state, pe, op1);
  const v2 = getOperandValue(state, pe, op2);
  
  if (v1 === null) return { err: `Invalid operand: ${op1}` };
  if (v2 === null) return { err: `Invalid operand: ${op2}` };
  
  return { rd, v1, v2 };
}

// Write ALU result: always to ROUT, optionally to Rd if specified
function writeAluResult(
  state: ReplState,
  pe: { row: number; col: number },
  peObj: PE,
  rd: string | undefined,
  result: number,
  description: string
): ExecutionResult {
  // ALU result always goes to ROUT (except NOP)
  peObj.registers.ROUT = result;
  updateFlags(peObj, result);
  
  // Optionally write to internal register (RF_WE=1)
  if (rd && rd.toUpperCase() !== 'ROUT') {
    const upper = rd.toUpperCase();
    if (['R0', 'R1', 'R2', 'R3'].includes(upper)) {
      setRegister(state, pe.row, pe.col, rd, result);
      peObj.lastModified = upper;
    } else {
      return { success: false, error: `Invalid destination register: ${rd} (use R0-R3)` };
    }
  } else {
    peObj.lastModified = 'ROUT';
  }
  
  return {
    success: true,
    message: rd ? `${rd} = ${description}` : `ROUT = ${description}`,
    value: result,
    register: rd || 'ROUT',
  };
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
