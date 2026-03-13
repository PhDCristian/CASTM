import {
  AstProgram,
  CompilerPass,
  InstructionAst
} from '@castm/compiler-ir';
import { parseIntegerLiteral } from '../pragma-args-utils.js';
import { transformInstructions } from '../desugar-utils.js';

function parseImmediateOperand(token: string): number | null {
  const trimmed = token.trim();
  const imm = trimmed.match(/^IMM\(([\s\S]+)\)$/i);
  if (imm) return parseIntegerLiteral(imm[1]);
  return parseIntegerLiteral(trimmed);
}

function makeCopy(instruction: InstructionAst, dst: string, src: string): InstructionAst {
  return {
    ...instruction,
    opcode: 'SADD',
    operands: [dst, src, 'ZERO'],
    text: `SADD ${dst}, ${src}, ZERO`
  };
}

function makeZero(instruction: InstructionAst, dst: string): InstructionAst {
  return {
    ...instruction,
    opcode: 'SADD',
    operands: [dst, 'ZERO', 'ZERO'],
    text: `SADD ${dst}, ZERO, ZERO`
  };
}

function specializeInstruction(instruction: InstructionAst): InstructionAst {
  if (!instruction.opcode || instruction.operands.length < 3) return instruction;

  const opcode = instruction.opcode.toUpperCase();
  const [dst, lhs, rhs] = instruction.operands;
  const lhsValue = parseImmediateOperand(lhs);
  const rhsValue = parseImmediateOperand(rhs);

  if (opcode === 'SMUL') {
    if (lhsValue === 0 || rhsValue === 0) return makeZero(instruction, dst);
    if (rhsValue === 1) return makeCopy(instruction, dst, lhs);
    if (lhsValue === 1) return makeCopy(instruction, dst, rhs);
    return instruction;
  }

  if (opcode === 'SADD') {
    if (rhsValue === 0) return makeCopy(instruction, dst, lhs);
    if (lhsValue === 0) return makeCopy(instruction, dst, rhs);
    return instruction;
  }

  if (opcode === 'SSUB') {
    if (rhsValue === 0) return makeCopy(instruction, dst, lhs);
    return instruction;
  }

  if (opcode === 'LAND') {
    if (lhsValue === 0 || rhsValue === 0) return makeZero(instruction, dst);
    return instruction;
  }

  if (opcode === 'LOR') {
    if (rhsValue === 0) return makeCopy(instruction, dst, lhs);
    if (lhsValue === 0) return makeCopy(instruction, dst, rhs);
    return instruction;
  }

  if (opcode === 'LXOR') {
    if (rhsValue === 0) return makeCopy(instruction, dst, lhs);
    if (lhsValue === 0) return makeCopy(instruction, dst, rhs);
    if (lhs.trim() === rhs.trim()) return makeZero(instruction, dst);
    return instruction;
  }

  if (opcode === 'SLT' || opcode === 'SRT' || opcode === 'SRA') {
    if (rhsValue === 0) return makeCopy(instruction, dst, lhs);
    if (lhsValue === 0) return makeZero(instruction, dst);
    return instruction;
  }

  return instruction;
}

export const specializePass: CompilerPass<AstProgram, AstProgram> = {
  name: 'specialize',
  run(input) {
    const { output, diagnostics } = transformInstructions(input, (instruction) => specializeInstruction(instruction));
    return { output, diagnostics };
  }
};
