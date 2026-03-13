import { InstructionAst, spanAt } from '@castm/compiler-ir';
import { splitTopLevel } from '../parser-utils/strings.js';

export function parseInstruction(text: string, line: number, column: number): InstructionAst {
  const clean = text.trim();

  if (clean === '_' || clean.toUpperCase() === 'NOP') {
    return {
      text: 'NOP',
      opcode: 'NOP',
      operands: [],
      span: spanAt(line, column, clean.length)
    };
  }

  if (clean.includes('=')) {
    return {
      text: clean,
      opcode: null,
      operands: [],
      span: spanAt(line, column, clean.length)
    };
  }

  const firstSpace = clean.indexOf(' ');
  if (firstSpace < 0) {
    return {
      text: clean,
      opcode: clean.toUpperCase(),
      operands: [],
      span: spanAt(line, column, clean.length)
    };
  }

  const opcode = clean.slice(0, firstSpace).toUpperCase();
  const rest = clean.slice(firstSpace + 1);
  const operands = splitTopLevel(rest, ',').map((x) => x.trim()).filter(Boolean);

  return {
    text: clean,
    opcode,
    operands,
    span: spanAt(line, column, clean.length)
  };
}
