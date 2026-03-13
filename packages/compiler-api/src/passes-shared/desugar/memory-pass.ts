import {
  AstProgram,
  CompilerPass,
  ErrorCodes,
  makeDiagnostic
} from '@castm/compiler-ir';
import { isIdentifier } from '../pragma-args-utils.js';
import {
  DataSymbolInfo,
  isMemoryReference,
  splitAssignment,
  toAddressOperand,
  transformInstructions
} from '../desugar-utils.js';

export function createDesugarMemoryPass(
  dataSymbols: ReadonlyMap<string, DataSymbolInfo> = new Map()
): CompilerPass<AstProgram, AstProgram> {
  return {
    name: 'desugar-memory',
    run(input) {
      const { output, diagnostics } = transformInstructions(input, (instruction, passDiagnostics) => {
        if (instruction.opcode) {
          const opcode = instruction.opcode.toUpperCase();
          if (opcode === 'LWI' || opcode === 'SWI') {
            if (instruction.operands.length < 2) {
              passDiagnostics.push(makeDiagnostic(
                ErrorCodes.Semantic.InvalidAssignment,
                'error',
                instruction.span,
                `${opcode} expects at least 2 operands.`,
                `Valid form: ${opcode} R0, [addr]`
              ));
              return instruction;
            }

            const normalizedAddr = toAddressOperand(
              instruction.operands[1],
              dataSymbols,
              passDiagnostics,
              instruction.span
            );
            if (!normalizedAddr) return instruction;

            return {
              ...instruction,
              operands: [instruction.operands[0], normalizedAddr, ...instruction.operands.slice(2)],
              text: `${opcode} ${instruction.operands[0]}, ${normalizedAddr}`
            };
          }

          return instruction;
        }

        const assignment = splitAssignment(instruction.text);
        if (!assignment) return instruction;

        const lhs = assignment.lhs.trim();
        const rhs = assignment.rhs.trim();
        const lhsMem = isMemoryReference(lhs);
        const rhsMem = isMemoryReference(rhs);

        if (!lhsMem && !rhsMem) return instruction;

        if (lhsMem && rhsMem) {
          passDiagnostics.push(makeDiagnostic(
            ErrorCodes.Semantic.InvalidAssignment,
            'error',
            instruction.span,
            'Memory-to-memory assignment is not supported.',
            'Use a temporary register: R0 = src[i]; dst[i] = R0;'
          ));
          return instruction;
        }

        if (lhsMem) {
          if (!isIdentifier(rhs)) {
            passDiagnostics.push(makeDiagnostic(
              ErrorCodes.Semantic.InvalidAssignment,
              'error',
              instruction.span,
              `Store source must be a register-like identifier, got '${rhs}'.`,
              'Valid form: A[i] = R3; or [addr] = R3;'
            ));
            return instruction;
          }

          const address = toAddressOperand(lhs, dataSymbols, passDiagnostics, instruction.span);
          if (!address) return instruction;

          return {
            ...instruction,
            opcode: 'SWI',
            operands: [rhs, address],
            text: `SWI ${rhs}, ${address}`
          };
        }

        if (!isIdentifier(lhs)) {
          passDiagnostics.push(makeDiagnostic(
            ErrorCodes.Semantic.InvalidAssignment,
            'error',
            instruction.span,
            `Load destination must be a register-like identifier, got '${lhs}'.`,
            'Valid form: R3 = A[i]; or R3 = [addr];'
          ));
          return instruction;
        }

        const address = toAddressOperand(rhs, dataSymbols, passDiagnostics, instruction.span);
        if (!address) return instruction;

        return {
          ...instruction,
          opcode: 'LWI',
          operands: [lhs, address],
          text: `LWI ${lhs}, ${address}`
        };
      });

      return { output, diagnostics };
    }
  };
}

export const desugarMemoryPass = createDesugarMemoryPass();
