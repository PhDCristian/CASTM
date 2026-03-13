import {
  CycleAst,
  InstructionAst
} from '@castm/compiler-ir';
import { escapeRegExp } from '../../parser-utils/strings.js';

export interface RuntimeNoUnrollAggressivePlan {
  bodyRow: number;
  bodyCol: number;
  incomingRegister: string;
  relayRegister: string;
  bodyInstruction: InstructionAst;
}

function getHorizontalIncomingRegister(controlCol: number, bodyCol: number): string | null {
  if (((controlCol + 1) % 4) === bodyCol) return 'RCL';
  if (((controlCol + 3) % 4) === bodyCol) return 'RCR';
  return null;
}

export function chooseJumpColumn(controlCol: number, bodyCol?: number): number {
  const candidates = [
    (controlCol + 1) % 4,
    (controlCol + 2) % 4,
    (controlCol + 3) % 4
  ];
  for (const candidate of candidates) {
    if (candidate !== controlCol && (bodyCol === undefined || candidate !== bodyCol)) {
      return candidate;
    }
  }
  return controlCol;
}

export function buildRuntimeNoUnrollExitBranch(
  variable: string,
  end: number,
  endLabel: string,
  step: number
): string {
  if (step > 0) {
    return `BGE ${variable}, ${end}, ${endLabel}`;
  }

  return `BGE ${end}, ${variable}, ${endLabel}`;
}

function pickRuntimeRelayRegister(loopRegister: string, instructionText: string): string {
  const candidates = ['R3', 'R2', 'R1', 'R0'];
  for (const candidate of candidates) {
    if (candidate === loopRegister) continue;
    if (!new RegExp(`\\b${escapeRegExp(candidate)}\\b`).test(instructionText)) {
      return candidate;
    }
  }
  return 'R3';
}

export function buildRuntimeNoUnrollAggressivePlan(
  loopCycles: CycleAst[],
  loopRegister: string,
  controlRow: number,
  controlCol: number,
  cycleHasControlFlow: (cycle: CycleAst) => boolean,
  parseInstruction: (text: string, line: number, column: number) => InstructionAst
): RuntimeNoUnrollAggressivePlan | null {
  if (loopCycles.length !== 1) return null;
  const cycle = loopCycles[0];
  if (cycle.label) return null;
  if (cycleHasControlFlow(cycle)) return null;
  if (cycle.statements.length !== 1) return null;

  const statement = cycle.statements[0];
  if (statement.kind !== 'at') return null;
  if (statement.row !== controlRow) return null;
  if (statement.col === controlCol) return null;

  const incoming = getHorizontalIncomingRegister(controlCol, statement.col);
  if (!incoming) return null;

  const loopVarPattern = new RegExp(`\\b${escapeRegExp(loopRegister)}\\b`);
  if (!loopVarPattern.test(statement.instruction.text)) return null;

  const relayRegister = pickRuntimeRelayRegister(loopRegister, statement.instruction.text);
  const replacedText = statement.instruction.text.replace(new RegExp(`\\b${escapeRegExp(loopRegister)}\\b`, 'g'), relayRegister);
  const bodyInstruction = parseInstruction(
    replacedText,
    statement.instruction.span.startLine,
    statement.instruction.span.startColumn
  );

  return {
    bodyRow: statement.row,
    bodyCol: statement.col,
    incomingRegister: incoming,
    relayRegister,
    bodyInstruction
  };
}
