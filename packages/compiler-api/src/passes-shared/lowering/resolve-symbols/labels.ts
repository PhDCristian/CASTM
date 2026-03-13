import {
  Diagnostic,
  ErrorCodes,
  SourceSpan,
  makeDiagnostic
} from '@castm/compiler-ir';
import { isNumericLiteralToken } from '../../pragma-args-utils.js';

/**
 * Branch instructions: label operand is REQUIRED — an unresolved
 * non-numeric token at the label position triggers E3009.
 */
const BRANCH_LABEL_OPERAND_INDEX: Readonly<Record<string, number>> = {
  BEQ: 2,
  BNE: 2,
  BLT: 2,
  BGE: 2
};

/**
 * Carrier instructions: label operand is OPTIONAL — if the token at
 * this index matches a known label it is resolved; otherwise it is
 * left untouched (it might be a register or other valid operand).
 * This enables patterns like `SADD R3, ZERO, returnLabel`.
 */
const CARRIER_LABEL_OPERAND_INDEX: Readonly<Record<string, number>> = {
  JUMP: 1,
  SADD: 2
};

export function resolveLabelOperand(
  opcode: string,
  operands: string[],
  labels: ReadonlyMap<string, number>,
  span: SourceSpan,
  diagnostics: Diagnostic[]
): string[] {
  // ── Strict branch resolution ──
  const branchIndex = BRANCH_LABEL_OPERAND_INDEX[opcode];
  if (branchIndex !== undefined && branchIndex >= 0 && branchIndex < operands.length) {
    const token = operands[branchIndex].trim();
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
        'Declare the label with syntax: labelName: bundle { ... }'
      ));
      return [...operands];
    }

    const resolved = [...operands];
    resolved[branchIndex] = String(targetCycle);
    return resolved;
  }

  // ── Opportunistic carrier resolution ──
  const carrierIndex = CARRIER_LABEL_OPERAND_INDEX[opcode];
  if (carrierIndex !== undefined && carrierIndex >= 0 && carrierIndex < operands.length) {
    const token = operands[carrierIndex].trim();
    if (!token || isNumericLiteralToken(token)) {
      return [...operands];
    }

    const targetCycle = labels.get(token);
    if (targetCycle !== undefined) {
      const resolved = [...operands];
      resolved[carrierIndex] = String(targetCycle);
      return resolved;
    }

    if (opcode === 'JUMP') {
      const bodyTargetCycle = labels.get(`${token}__body`);
      if (bodyTargetCycle !== undefined) {
        const resolved = [...operands];
        resolved[carrierIndex] = String(bodyTargetCycle);
        return resolved;
      }
    }
    // Not a known label — leave the operand as-is (could be a register).
  }

  return [...operands];
}

