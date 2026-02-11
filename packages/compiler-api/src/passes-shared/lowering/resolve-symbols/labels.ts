import {
  Diagnostic,
  ErrorCodes,
  SourceSpan,
  makeDiagnostic
} from '@openedge/compiler-ir';
import { isNumericLiteralToken } from '../../pragma-args-utils.js';

const BRANCH_LABEL_OPERAND_INDEX: Readonly<Record<string, number>> = {
  BEQ: 2,
  BNE: 2,
  BLT: 2,
  BGE: 2,
  JUMP: 0
};

export function resolveLabelOperand(
  opcode: string,
  operands: string[],
  labels: ReadonlyMap<string, number>,
  span: SourceSpan,
  diagnostics: Diagnostic[]
): string[] {
  const index = BRANCH_LABEL_OPERAND_INDEX[opcode];
  if (index === undefined || index < 0 || index >= operands.length) {
    return [...operands];
  }

  const token = operands[index].trim();
  if (!token || isNumericLiteralToken(token)) {
    return [...operands];
  }

  const targetCycle = labels.get(token);
  if (targetCycle === undefined) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Semantic.UnknownLabel,
      'error',
      span,
      `Unknown branch label '${token}'.`,
      'Declare the label with syntax: labelName: cycle { ... }'
    ));
    return [...operands];
  }

  const resolved = [...operands];
  resolved[index] = String(targetCycle);
  return resolved;
}
