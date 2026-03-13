import {
  AstProgram,
  CompilerPass,
  ErrorCodes,
  makeDiagnostic
} from '@castm/compiler-ir';
import { isIdentifier } from '../pragma-args-utils.js';
import {
  isMemoryReference,
  splitAssignment,
  splitTopLevelBinary,
  transformInstructions
} from '../desugar-utils.js';

const BINARY_OPCODES: Record<string, string> = {
  '+': 'SADD',
  '-': 'SSUB',
  '*': 'SMUL',
  '**': 'FXPMUL',
  '&': 'LAND',
  '~&': 'LNAND',
  '|': 'LOR',
  '~|': 'LNOR',
  '^': 'LXOR',
  '~^': 'LXNOR',
  '<<': 'SLT',
  '>>': 'SRT',
  '>>>': 'SRA'
};

export const desugarExpressionsPass: CompilerPass<AstProgram, AstProgram> = {
  name: 'desugar-expressions',
  run(input) {
    const { output, diagnostics } = transformInstructions(input, (instruction, passDiagnostics) => {
      if (instruction.opcode) return instruction;

      const assignment = splitAssignment(instruction.text);
      if (!assignment) return instruction;

      const lhs = assignment.lhs.trim();
      const rhs = assignment.rhs.trim();

      if (isMemoryReference(lhs) || isMemoryReference(rhs)) {
        return instruction;
      }

      if (!isIdentifier(lhs)) {
        passDiagnostics.push(makeDiagnostic(
          ErrorCodes.Semantic.InvalidAssignment,
          'error',
          instruction.span,
          `Invalid assignment destination '${lhs}'.`,
          'Expected a register-like identifier at the left-hand side.'
        ));
        return instruction;
      }

      const binary = splitTopLevelBinary(rhs);
      if (!binary) {
        return {
          ...instruction,
          opcode: 'SADD',
          operands: [lhs, rhs, 'ZERO'],
          text: `SADD ${lhs}, ${rhs}, ZERO`
        };
      }

      if (!binary.left || !binary.right) {
        passDiagnostics.push(makeDiagnostic(
          ErrorCodes.Semantic.UnsupportedOperation,
          'error',
          instruction.span,
          `Unsupported expression '${instruction.text}'.`,
          'Expected binary form: dst = a OP b.'
        ));
        return instruction;
      }

      const opcode = BINARY_OPCODES[binary.op];
      if (!opcode) {
        passDiagnostics.push(makeDiagnostic(
          ErrorCodes.Semantic.UnsupportedOperation,
          'error',
          instruction.span,
          `Unsupported operator '${binary.op}'.`,
          'Supported operators: + - * ** & ~& | ~| ^ ~^ << >> >>>'
        ));
        return instruction;
      }

      return {
        ...instruction,
        opcode,
        operands: [lhs, binary.left, binary.right],
        text: `${opcode} ${lhs}, ${binary.left}, ${binary.right}`
      };
    });

    return { output, diagnostics };
  }
};
