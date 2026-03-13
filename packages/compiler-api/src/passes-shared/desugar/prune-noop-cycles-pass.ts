import {
  AstProgram,
  CompilerPass,
  CycleAst,
  CycleStatementAst,
  InstructionAst
} from '@castm/compiler-ir';
import { cloneAst } from '../ast-utils.js';

const BRANCH_OPCODES = new Set([
  'BEQ',
  'BNE',
  'BGT',
  'BGE',
  'BLT',
  'BLE',
  'BRA',
  'JMP'
]);

function normalizeOpcode(instruction: InstructionAst): string {
  if (instruction.opcode) return instruction.opcode.toUpperCase();
  const text = instruction.text.trim();
  const firstSpace = text.indexOf(' ');
  const token = firstSpace === -1 ? text : text.slice(0, firstSpace);
  return token.toUpperCase();
}

function instructionOperands(instruction: InstructionAst): string[] {
  if (instruction.operands.length > 0) return instruction.operands;
  const payload = instruction.text.trim().replace(/^[A-Za-z_][A-Za-z0-9_]*/, '').trim();
  if (!payload) return [];
  return payload.split(',').map((token) => token.trim()).filter(Boolean);
}

function isIntegerLiteral(value: string): boolean {
  return /^[-+]?(?:\d+|0x[0-9a-fA-F]+)$/i.test(value.trim());
}

function isNopInstruction(instruction: InstructionAst): boolean {
  const opcode = normalizeOpcode(instruction);
  if (opcode === 'NOP') return true;
  return instruction.text.trim() === '_';
}

function isNopStatement(statement: CycleStatementAst): boolean {
  if (statement.kind === 'row') {
    return statement.instructions.every(isNopInstruction);
  }

  return isNopInstruction(statement.instruction);
}

function cycleIsNoopOnly(cycle: CycleAst): boolean {
  return cycle.statements.every(isNopStatement);
}

function hasNumericBranchTarget(ast: AstProgram): boolean {
  const cycles = ast.kernel!.cycles;
  for (const cycle of cycles) {
    for (const statement of cycle.statements) {
      const instructions = statement.kind === 'row'
        ? statement.instructions
        : [statement.instruction];

      for (const instruction of instructions) {
        const opcode = normalizeOpcode(instruction);
        if (!BRANCH_OPCODES.has(opcode)) continue;
        const operands = instructionOperands(instruction);
        const target = operands[operands.length - 1];
        if (!target) continue;
        if (isIntegerLiteral(target)) return true;
      }
    }
  }
  return false;
}

export const pruneNoopCyclesPass: CompilerPass<AstProgram, AstProgram> = {
  name: 'prune-noop-cycles',
  run(input) {
    const output = cloneAst(input);
    if (!output.kernel) return { output, diagnostics: [] };

    if (hasNumericBranchTarget(output)) {
      return { output, diagnostics: [] };
    }

    const kept = output.kernel.cycles.filter((cycle) => cycle.label || !cycleIsNoopOnly(cycle));
    if (kept.length === output.kernel.cycles.length) {
      return { output, diagnostics: [] };
    }

    output.kernel.cycles = kept.map((cycle, index) => ({
      ...cycle,
      index
    }));
    return { output, diagnostics: [] };
  }
};
