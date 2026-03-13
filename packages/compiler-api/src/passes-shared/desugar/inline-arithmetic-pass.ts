import {
  AstProgram,
  CompilerPass
} from '@castm/compiler-ir';
import { transformInstructions } from '../desugar-utils.js';

function hasInlineArithmetic(text: string): boolean {
  const compact = text.replace(/\s+/g, '');
  if (/[+*/%<>&|^~()]/.test(compact)) return true;
  const minus = compact.indexOf('-');
  return minus > 0;
}

function evaluateInlineInteger(expr: string): number | null {
  const compact = expr.trim();
  if (!/^[0-9a-fA-FxX+\-*/%()<>&|^~\s]+$/.test(compact)) return null;

  try {
    const value = Function(`"use strict"; return (${compact});`)();
    if (typeof value !== 'number' || !Number.isFinite(value)) return null;
    return Math.trunc(value);
  } catch {
    return null;
  }
}

function foldOperand(token: string): string {
  const imm = token.match(/^IMM\(([\s\S]+)\)$/i);
  if (imm) {
    const inner = imm[1].trim();
    if (!hasInlineArithmetic(inner)) return inner;
    const folded = evaluateInlineInteger(inner);
    return folded === null ? inner : String(folded);
  }

  if (!hasInlineArithmetic(token)) return token;
  const folded = evaluateInlineInteger(token);
  return folded === null ? token : String(folded);
}

export const desugarInlineArithmeticPass: CompilerPass<AstProgram, AstProgram> = {
  name: 'desugar-inline-arithmetic',
  run(input) {
    const { output, diagnostics } = transformInstructions(input, (instruction) => {
      if (!instruction.opcode || instruction.operands.length === 0) return instruction;

      const foldedOperands = instruction.operands.map((operand) => foldOperand(operand));
      const changed = foldedOperands.some((operand, index) => operand !== instruction.operands[index]);
      if (!changed) return instruction;

      return {
        ...instruction,
        operands: foldedOperands,
        text: `${instruction.opcode.toUpperCase()} ${foldedOperands.join(', ')}`
      };
    });

    return { output, diagnostics };
  }
};
