import {
  CycleAst,
  Diagnostic,
  InstructionAst
} from '@openedge/compiler-ir';
import { ErrorCodes, makeDiagnostic, spanAt } from '@openedge/compiler-ir';
import type { ForHeader } from './control-flow.js';
import type { SourceLineEntry } from '../parser-utils/blocks.js';
import { applyBindings } from '../parser-utils/numbers.js';
import { escapeRegExp } from '../parser-utils/strings.js';

export interface RuntimeNoUnrollAggressivePlan {
  bodyRow: number;
  bodyCol: number;
  incomingRegister: string;
  relayRegister: string;
  bodyInstruction: InstructionAst;
}

export function instantiateEntriesWithBindings(
  body: SourceLineEntry[],
  bindings: ReadonlyMap<string, number>
): SourceLineEntry[] {
  if (bindings.size === 0) {
    return body.map((entry) => ({
      lineNo: entry.lineNo,
      rawLine: entry.rawLine,
      cleanLine: entry.cleanLine
    }));
  }

  return body.map((entry) => ({
    lineNo: entry.lineNo,
    rawLine: applyBindings(entry.rawLine, bindings),
    cleanLine: applyBindings(entry.cleanLine, bindings)
  }));
}

export function enumerateForValues(
  header: ForHeader,
  lineNo: number,
  lineLength: number,
  diagnostics: Diagnostic[]
): number[] | null {
  const values: number[] = [];
  const shouldContinue = header.step > 0
    ? (value: number) => value < header.end
    : (value: number) => value > header.end;

  const maxIterations = 100_000;
  for (let value = header.start, count = 0; shouldContinue(value); value += header.step, count++) {
    if (count >= maxIterations) {
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Semantic.UnsupportedOperation,
        'error',
        spanAt(lineNo, 1, lineLength),
        `For loop exceeds max supported iterations (${maxIterations}).`,
        'Reduce the loop range or use explicit runtime loop syntax: for R0 in range(...) at @row,col runtime { ... }.'
      ));
      return null;
    }
    values.push(value);
  }
  return values;
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
    return `BGE ${variable}, IMM(${end}), ${endLabel}`;
  }

  return `BGE IMM(${end}), ${variable}, ${endLabel}`;
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
