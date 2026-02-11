import {
  AstProgram,
  CycleAst,
  CycleStatementAst,
  DirectiveAst,
  Diagnostic,
  InstructionAst,
  KernelAst,
  ParseResult,
  SourceSpan
} from '@openedge/compiler-ir';
import { ErrorCodes, makeDiagnostic, spanAt } from '@openedge/compiler-ir';

function parseNumber(text: string): number {
  const trimmed = text.trim();
  if (/^-?0x[0-9a-f]+$/i.test(trimmed)) {
    const sign = trimmed.startsWith('-') ? -1 : 1;
    const hex = trimmed.startsWith('-') ? trimmed.slice(1) : trimmed;
    return sign * parseInt(hex, 16);
  }
  return parseInt(trimmed, 10);
}

function splitTopLevel(input: string, delimiter: string): string[] {
  const out: string[] = [];
  let current = '';
  let paren = 0;
  let bracket = 0;

  for (const ch of input) {
    if (ch === '(') paren++;
    if (ch === ')') paren = Math.max(0, paren - 1);
    if (ch === '[') bracket++;
    if (ch === ']') bracket = Math.max(0, bracket - 1);

    if (ch === delimiter && paren === 0 && bracket === 0) {
      out.push(current.trim());
      current = '';
      continue;
    }

    current += ch;
  }

  if (current.trim().length > 0) out.push(current.trim());
  return out;
}

function stripLineComment(line: string): string {
  return line.replace(/\/\/.*$/, '');
}

function countChar(text: string, needle: string): number {
  let count = 0;
  for (const ch of text) {
    if (ch === needle) count++;
  }
  return count;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function applyBindings(input: string, bindings: ReadonlyMap<string, number>): string {
  let out = input;
  for (const [name, value] of bindings.entries()) {
    const regex = new RegExp(`\\b${escapeRegExp(name)}\\b`, 'g');
    out = out.replace(regex, String(value));
  }
  return out;
}

function evaluateNumericExpression(
  expression: string,
  constants: ReadonlyMap<string, number>,
  bindings: ReadonlyMap<string, number>
): number | null {
  const unresolved: string[] = [];
  const replaced = expression.replace(/\b[A-Za-z_][A-Za-z0-9_]*\b/g, (name) => {
    if (bindings.has(name)) return String(bindings.get(name));
    if (constants.has(name)) return String(constants.get(name));
    unresolved.push(name);
    return name;
  });

  if (unresolved.length > 0) {
    return null;
  }

  if (!/^[0-9a-fA-FxX+\-*/%()\s]+$/.test(replaced)) {
    return null;
  }

  try {
    const value = Function(`"use strict"; return (${replaced});`)();
    if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isInteger(value)) {
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

function parseInstruction(text: string, line: number, column: number): InstructionAst {
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

function parseDirective(clean: string, line: number): DirectiveAst | null {
  const constMatch = clean.match(/^\.const\s+([A-Za-z_][A-Za-z0-9_]*)\s*(?:=\s*)?(.+)$/i);
  if (constMatch) {
    return {
      kind: 'const',
      name: constMatch[1],
      value: constMatch[2].trim(),
      span: spanAt(line, 1, clean.length)
    };
  }

  const aliasMatch = clean.match(/^\.alias\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*([A-Za-z_][A-Za-z0-9_]*)$/i);
  if (aliasMatch) {
    return {
      kind: 'alias',
      name: aliasMatch[1],
      value: aliasMatch[2],
      span: spanAt(line, 1, clean.length)
    };
  }

  const dataMatch = clean.match(/^\.data\s+([A-Za-z_][A-Za-z0-9_]*)\s+(.+)$/i);
  if (dataMatch) {
    return {
      kind: 'data',
      name: dataMatch[1],
      value: dataMatch[2].trim(),
      span: spanAt(line, 1, clean.length)
    };
  }

  const data2dMatch = clean.match(/^\.data2d\s+([A-Za-z_][A-Za-z0-9_]*)\s*(.+)$/i);
  if (data2dMatch) {
    return {
      kind: 'data2d',
      name: data2dMatch[1],
      value: data2dMatch[2].trim(),
      span: spanAt(line, 1, clean.length)
    };
  }

  if (clean.startsWith('.')) {
    return {
      kind: 'raw',
      name: clean.split(/\s+/)[0].slice(1),
      value: clean,
      span: spanAt(line, 1, clean.length)
    };
  }

  return null;
}

function parseCycleStatement(
  clean: string,
  line: number,
  rawLine: string,
  constants: ReadonlyMap<string, number>,
  bindings: ReadonlyMap<string, number>
): CycleStatementAst | null {
  const atMatch = clean.match(/^@\s*([^,]+)\s*,\s*([^:]+)\s*:\s*(.+);\s*$/i);
  if (atMatch) {
    const row = evaluateNumericExpression(atMatch[1].trim(), constants, bindings);
    const col = evaluateNumericExpression(atMatch[2].trim(), constants, bindings);
    if (row === null || col === null) return null;
    const instructionText = atMatch[3].trim();
    const column = Math.max(1, rawLine.indexOf(instructionText) + 1);
    return {
      kind: 'at',
      row,
      col,
      instruction: parseInstruction(instructionText, line, column),
      span: spanAt(line, 1, clean.length)
    };
  }

  const rowMatch = clean.match(/^row\s+([^:]+)\s*:\s*(.+);\s*$/i);
  if (rowMatch) {
    const row = evaluateNumericExpression(rowMatch[1].trim(), constants, bindings);
    if (row === null) return null;
    const payload = rowMatch[2].trim();
    const segments = splitTopLevel(payload, '|').map((s) => s.trim());
    return {
      kind: 'row',
      row,
      instructions: segments.map((segment) => parseInstruction(segment, line, Math.max(1, rawLine.indexOf(segment) + 1))),
      span: spanAt(line, 1, clean.length)
    };
  }

  const colMatch = clean.match(/^col\s+([^:]+)\s*:\s*(.+);\s*$/i);
  if (colMatch) {
    const col = evaluateNumericExpression(colMatch[1].trim(), constants, bindings);
    if (col === null) return null;
    const instructionText = colMatch[2].trim();
    return {
      kind: 'col',
      col,
      instruction: parseInstruction(instructionText, line, Math.max(1, rawLine.indexOf(instructionText) + 1)),
      span: spanAt(line, 1, clean.length)
    };
  }

  const allMatch = clean.match(/^all\s*:\s*(.+);\s*$/i);
  if (allMatch) {
    const instructionText = allMatch[1].trim();
    return {
      kind: 'all',
      instruction: parseInstruction(instructionText, line, Math.max(1, rawLine.indexOf(instructionText) + 1)),
      span: spanAt(line, 1, clean.length)
    };
  }

  return null;
}

interface AutoCycleOccupancy {
  all: boolean;
  rows: Set<number>;
  cols: Set<number>;
  points: Set<string>;
}

function createAutoCycleOccupancy(): AutoCycleOccupancy {
  return {
    all: false,
    rows: new Set<number>(),
    cols: new Set<number>(),
    points: new Set<string>()
  };
}

function autoCycleHasConflict(statement: CycleStatementAst, occupancy: AutoCycleOccupancy): boolean {
  if (occupancy.all) return true;

  if (statement.kind === 'all') {
    return occupancy.rows.size > 0 || occupancy.cols.size > 0 || occupancy.points.size > 0;
  }

  if (statement.kind === 'at') {
    const key = `${statement.row},${statement.col}`;
    if (occupancy.points.has(key)) return true;
    if (occupancy.rows.has(statement.row)) return true;
    if (occupancy.cols.has(statement.col)) return true;
    return false;
  }

  if (statement.kind === 'row') {
    if (occupancy.cols.size > 0) return true;
    if (occupancy.rows.has(statement.row)) return true;
    for (const point of occupancy.points) {
      const [pointRow] = point.split(',').map((x) => parseInt(x, 10));
      if (pointRow === statement.row) return true;
    }
    return false;
  }

  if (statement.kind === 'col') {
    if (occupancy.rows.size > 0) return true;
    if (occupancy.cols.has(statement.col)) return true;
    for (const point of occupancy.points) {
      const [, pointCol] = point.split(',').map((x) => parseInt(x, 10));
      if (pointCol === statement.col) return true;
    }
    return false;
  }

  return false;
}

function markAutoCycleOccupancy(statement: CycleStatementAst, occupancy: AutoCycleOccupancy): void {
  if (statement.kind === 'all') {
    occupancy.all = true;
    return;
  }

  if (statement.kind === 'at') {
    occupancy.points.add(`${statement.row},${statement.col}`);
    return;
  }

  if (statement.kind === 'row') {
    occupancy.rows.add(statement.row);
    return;
  }

  occupancy.cols.add(statement.col);
}

interface ForHeader {
  variable: string;
  start: number;
  end: number;
  step: number;
  control?: {
    row: number;
    col: number;
  };
}

interface ParsedControlPragma {
  kind: 'unroll' | 'no_unroll' | 'parallel' | 'no_fuse';
  span: SourceSpan;
  unrollFactor?: number;
  collapseLevels?: number;
}

interface PendingControlPragmas {
  span: SourceSpan;
  unrollFactor?: number;
  noUnroll?: boolean;
  parallelCollapseLevels?: number;
  noFuse?: boolean;
}

interface SourceLineEntry {
  lineNo: number;
  rawLine: string;
  cleanLine: string;
}

interface CollectedBlock {
  body: SourceLineEntry[];
  endIndex: number | null;
  trailingAfterClose?: string;
}

interface FunctionDefinitionLite {
  name: string;
  params: string[];
  body: SourceLineEntry[];
  span: SourceSpan;
}

interface ParsedLabeledCycle {
  label: string;
  inlinePayload?: string;
}

interface ParsedCondition {
  lhs: string;
  operator: '==' | '!=' | '<' | '>=' | '>' | '<=';
  rhs: string;
}

interface ParsedControlHeader {
  condition: ParsedCondition;
  row: number;
  col: number;
}

function parseForHeader(
  cleanLine: string,
  lineNo: number,
  constants: ReadonlyMap<string, number>,
  bindings: ReadonlyMap<string, number>,
  diagnostics: Diagnostic[]
): ForHeader | null {
  const loopMatch = cleanLine.match(
    /^for\s+([A-Za-z_][A-Za-z0-9_]*)\s+in\s+range\s*\((.*)\)\s*(?:@\s*([^,{\s]+)\s*,\s*([^{\s]+))?\s*\{\s*$/i
  );
  if (!loopMatch) return null;

  const variable = loopMatch[1];
  const argsText = loopMatch[2].trim();
  const args = argsText.length === 0 ? [] : splitTopLevel(argsText, ',');

  if (args.length < 1 || args.length > 3) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      spanAt(lineNo, 1, cleanLine.length),
      `Invalid range() in for loop: expected 1..3 arguments, got ${args.length}.`,
      'Valid forms: range(end), range(start,end), range(start,end,step).'
    ));
    return null;
  }

  const values: number[] = [];
  for (const arg of args) {
    const value = evaluateNumericExpression(arg.trim(), constants, bindings);
    if (value === null) {
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Parse.InvalidSyntax,
        'error',
        spanAt(lineNo, 1, cleanLine.length),
        `Invalid range() argument '${arg.trim()}' in for loop.`,
        'Use integer literals, constants, loop bindings, and + - * / % operators.'
      ));
      return null;
    }
    values.push(value);
  }

  let start = 0;
  let end = 0;
  let step = 1;
  if (values.length === 1) {
    end = values[0];
  } else if (values.length === 2) {
    start = values[0];
    end = values[1];
  } else {
    [start, end, step] = values;
  }

  if (step === 0) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      spanAt(lineNo, 1, cleanLine.length),
      'range() step cannot be zero.',
      'Use a non-zero step value.'
    ));
    return null;
  }

  let control: { row: number; col: number } | undefined;
  if (loopMatch[3] !== undefined && loopMatch[4] !== undefined) {
    const row = evaluateNumericExpression(loopMatch[3].trim(), constants, bindings);
    const col = evaluateNumericExpression(loopMatch[4].trim(), constants, bindings);
    if (row === null || col === null) {
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Parse.InvalidSyntax,
        'error',
        spanAt(lineNo, 1, cleanLine.length),
        `Invalid control location '@${loopMatch[3]},${loopMatch[4]}' in for loop.`,
        'Use integer literals, constants, loop bindings, and + - * / % operators.'
      ));
      return null;
    }
    control = { row, col };
  }

  return { variable, start, end, step, control };
}

interface ParseControlPragmaResult {
  consumed: boolean;
  pragma: ParsedControlPragma | null;
}

function parseControlPragma(
  cleanLine: string,
  lineNo: number,
  diagnostics: Diagnostic[]
): ParseControlPragmaResult {
  const pragmaMatch = cleanLine.match(/^#pragma\s+([A-Za-z_][A-Za-z0-9_]*)(.*)$/i);
  if (!pragmaMatch) return { consumed: false, pragma: null };

  const name = pragmaMatch[1].toLowerCase();
  const rest = pragmaMatch[2].trim();
  const span = spanAt(lineNo, 1, cleanLine.length);

  if (name === 'unroll') {
    if (!rest) return { consumed: true, pragma: { kind: 'unroll', span } };
    const factorMatch = rest.match(/^\(\s*(\d+)\s*\)$/);
    if (!factorMatch) {
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Parse.InvalidSyntax,
        'error',
        span,
        `Invalid unroll pragma syntax: '${cleanLine}'.`,
        'Use #pragma unroll or #pragma unroll(N) with N > 0.'
      ));
      return { consumed: true, pragma: null };
    }
    const factor = parseInt(factorMatch[1], 10);
    if (!Number.isInteger(factor) || factor <= 0) {
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Parse.InvalidSyntax,
        'error',
        span,
        `Invalid unroll factor '${factorMatch[1]}'.`,
        'Use a positive integer factor.'
      ));
      return { consumed: true, pragma: null };
    }
    return {
      consumed: true,
      pragma: { kind: 'unroll', span, unrollFactor: factor }
    };
  }

  if (name === 'no_unroll') {
    if (rest) {
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Parse.InvalidSyntax,
        'error',
        span,
        `Invalid no_unroll pragma syntax: '${cleanLine}'.`,
        'Use #pragma no_unroll without extra arguments.'
      ));
      return { consumed: true, pragma: null };
    }
    return { consumed: true, pragma: { kind: 'no_unroll', span } };
  }

  if (name === 'parallel') {
    if (!rest) {
      return {
        consumed: true,
        pragma: { kind: 'parallel', span, collapseLevels: 1 }
      };
    }
    const collapseMatch = rest.match(/^collapse(?:\s*\(\s*(\d+)\s*\))?$/i);
    if (!collapseMatch) {
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Parse.InvalidSyntax,
        'error',
        span,
        `Invalid parallel pragma syntax: '${cleanLine}'.`,
        'Use #pragma parallel, #pragma parallel collapse, or #pragma parallel collapse(N).'
      ));
      return { consumed: true, pragma: null };
    }
    const collapseLevels = collapseMatch[1] ? parseInt(collapseMatch[1], 10) : Number.POSITIVE_INFINITY;
    if (collapseMatch[1] && (!Number.isInteger(collapseLevels) || collapseLevels <= 0)) {
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Parse.InvalidSyntax,
        'error',
        span,
        `Invalid collapse depth '${collapseMatch[1]}'.`,
        'Use a positive integer in collapse(N).'
      ));
      return { consumed: true, pragma: null };
    }
    return {
      consumed: true,
      pragma: { kind: 'parallel', span, collapseLevels }
    };
  }

  if (name === 'no_fuse') {
    if (rest) {
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Parse.InvalidSyntax,
        'error',
        span,
        `Invalid no_fuse pragma syntax: '${cleanLine}'.`,
        'Use #pragma no_fuse without extra arguments.'
      ));
      return { consumed: true, pragma: null };
    }
    return { consumed: true, pragma: { kind: 'no_fuse', span } };
  }

  return { consumed: false, pragma: null };
}

function applyControlPragma(
  pending: PendingControlPragmas | null,
  pragma: ParsedControlPragma
): PendingControlPragmas {
  const next: PendingControlPragmas = pending
    ? { ...pending, span: pragma.span }
    : { span: pragma.span };

  if (pragma.kind === 'unroll') {
    next.noUnroll = false;
    next.unrollFactor = pragma.unrollFactor;
    return next;
  }

  if (pragma.kind === 'no_unroll') {
    next.noUnroll = true;
    next.unrollFactor = undefined;
    return next;
  }

  if (pragma.kind === 'parallel') {
    next.parallelCollapseLevels = pragma.collapseLevels;
    return next;
  }

  next.noFuse = true;
  return next;
}

function hasForScopedPragmas(pending: PendingControlPragmas | null): boolean {
  if (!pending) return false;
  return pending.noUnroll === true ||
    pending.unrollFactor !== undefined ||
    pending.parallelCollapseLevels !== undefined;
}

function hasAnyPendingPragmas(pending: PendingControlPragmas | null): boolean {
  if (!pending) return false;
  return hasForScopedPragmas(pending) || pending.noFuse === true;
}

function describePendingPragmas(pending: PendingControlPragmas | null): string {
  if (!pending) return '';
  const names: string[] = [];
  if (pending.unrollFactor !== undefined) names.push('unroll');
  else if (pending.noUnroll) names.push('no_unroll');
  if (pending.parallelCollapseLevels !== undefined) names.push('parallel');
  if (pending.noFuse) names.push('no_fuse');
  return names.join(', ');
}

function instantiateEntriesWithBindings(
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

function hasImmediateNestedForLoop(body: SourceLineEntry[]): boolean {
  for (const entry of body) {
    const clean = entry.cleanLine.trim();
    if (!clean) continue;
    if (/^#pragma\s+(unroll|no_unroll|parallel|no_fuse)\b/i.test(clean)) continue;
    return /^for\s+[A-Za-z_][A-Za-z0-9_]*\s+in\s+range\s*\(/i.test(clean);
  }
  return false;
}

function enumerateForValues(
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
        'Reduce the loop range or use #pragma no_unroll for runtime control.'
      ));
      return null;
    }
    values.push(value);
  }
  return values;
}

const CONTROL_FLOW_OPCODES = new Set(['BEQ', 'BNE', 'BLT', 'BGE', 'JUMP']);

function cycleHasControlFlow(cycle: CycleAst): boolean {
  if (cycle.label) return true;

  for (const statement of cycle.statements) {
    if (statement.kind === 'row') {
      if (statement.instructions.some((inst) => inst.opcode && CONTROL_FLOW_OPCODES.has(inst.opcode))) {
        return true;
      }
      continue;
    }

    if (statement.instruction.opcode && CONTROL_FLOW_OPCODES.has(statement.instruction.opcode)) {
      return true;
    }
  }
  return false;
}

interface WhileFusionPlan {
  bodyRow: number;
  bodyCol: number;
  incomingRegister: string;
}

function getWhileFusionIncomingRegister(
  controlRow: number,
  controlCol: number,
  bodyRow: number,
  bodyCol: number
): string | null {
  if (bodyRow === controlRow) {
    if (((controlCol + 1) % 4) === bodyCol) return 'RCR';
    if (((controlCol + 3) % 4) === bodyCol) return 'RCL';
    return null;
  }

  if (bodyCol !== controlCol) return null;
  if (bodyRow === controlRow - 1) return 'RCT';
  if (bodyRow === controlRow + 1) return 'RCB';
  return null;
}

function buildWhileFusionPlan(
  loopCycles: CycleAst[],
  controlRow: number,
  controlCol: number
): WhileFusionPlan | null {
  if (loopCycles.length !== 1) return null;
  const cycle = loopCycles[0];
  if (cycle.label) return null;
  if (cycleHasControlFlow(cycle)) return null;
  if (cycle.statements.length !== 1) return null;

  const statement = cycle.statements[0];
  if (statement.kind !== 'at') return null;
  if (statement.row === controlRow && statement.col === controlCol) return null;
  const incomingRegister = getWhileFusionIncomingRegister(controlRow, controlCol, statement.row, statement.col);
  if (!incomingRegister) return null;
  return {
    bodyRow: statement.row,
    bodyCol: statement.col,
    incomingRegister
  };
}

function rewriteConditionForWhileFusion(condition: ParsedCondition, incomingRegister: string): ParsedCondition {
  const replace = (operand: string): string => /^R\d+$/i.test(operand) ? incomingRegister : operand;
  return {
    lhs: replace(condition.lhs),
    operator: condition.operator,
    rhs: replace(condition.rhs)
  };
}

function cloneCycle(cycle: CycleAst, index: number): CycleAst {
  return {
    index,
    label: cycle.label,
    span: { ...cycle.span },
    statements: cycle.statements.map((statement) => {
      if (statement.kind === 'at') {
        return {
          kind: 'at' as const,
          row: statement.row,
          col: statement.col,
          instruction: {
            text: statement.instruction.text,
            opcode: statement.instruction.opcode,
            operands: [...statement.instruction.operands],
            span: { ...statement.instruction.span }
          },
          span: { ...statement.span }
        };
      }

      if (statement.kind === 'row') {
        return {
          kind: 'row' as const,
          row: statement.row,
          instructions: statement.instructions.map((instruction) => ({
            text: instruction.text,
            opcode: instruction.opcode,
            operands: [...instruction.operands],
            span: { ...instruction.span }
          })),
          span: { ...statement.span }
        };
      }

      if (statement.kind === 'col') {
        return {
          kind: 'col' as const,
          col: statement.col,
          instruction: {
            text: statement.instruction.text,
            opcode: statement.instruction.opcode,
            operands: [...statement.instruction.operands],
            span: { ...statement.instruction.span }
          },
          span: { ...statement.span }
        };
      }

      return {
        kind: 'all' as const,
        instruction: {
          text: statement.instruction.text,
          opcode: statement.instruction.opcode,
          operands: [...statement.instruction.operands],
          span: { ...statement.instruction.span }
        },
        span: { ...statement.span }
      };
    })
  };
}

function getHorizontalIncomingRegister(controlCol: number, bodyCol: number): string | null {
  if (((controlCol + 1) % 4) === bodyCol) return 'RCL';
  if (((controlCol + 3) % 4) === bodyCol) return 'RCR';
  return null;
}

function chooseJumpColumn(controlCol: number, bodyCol?: number): number {
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

function buildRuntimeNoUnrollExitBranch(
  variable: string,
  end: number,
  endLabel: string,
  step: number
): string {
  if (step > 0) {
    return `BGE ${variable}, IMM(${end}), ${endLabel}`;
  }

  // Descending ranges must terminate when variable <= end.
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

interface RuntimeNoUnrollAggressivePlan {
  bodyRow: number;
  bodyCol: number;
  incomingRegister: string;
  relayRegister: string;
  bodyInstruction: InstructionAst;
}

function buildRuntimeNoUnrollAggressivePlan(
  loopCycles: CycleAst[],
  loopRegister: string,
  controlRow: number,
  controlCol: number
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

function expandForLoopIntoKernel(
  header: ForHeader,
  loopBody: SourceLineEntry[],
  lineNo: number,
  lineLength: number,
  kernel: KernelAst,
  functions: ReadonlyMap<string, FunctionDefinitionLite>,
  constants: ReadonlyMap<string, number>,
  diagnostics: Diagnostic[],
  cycleCounter: { value: number },
  callStack: string[],
  expansionCounter: { value: number },
  controlFlowCounter: { value: number },
  pendingPragmas: PendingControlPragmas | null
): void {
  const noUnroll = pendingPragmas?.noUnroll === true;
  const unrollFactor = pendingPragmas?.unrollFactor;
  const collapseRequested = pendingPragmas?.parallelCollapseLevels !== undefined;

  if (noUnroll) {
    if (collapseRequested) {
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Semantic.UnsupportedOperation,
        'error',
        pendingPragmas?.span ?? spanAt(lineNo, 1, lineLength),
        'Cannot combine #pragma no_unroll with #pragma parallel collapse in v2 baseline.',
        'Use either runtime no_unroll or compile-time parallel collapse.'
      ));
      return;
    }

    if (!/^R\d+$/i.test(header.variable)) {
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Parse.InvalidSyntax,
        'error',
        pendingPragmas?.span ?? spanAt(lineNo, 1, lineLength),
        `#pragma no_unroll requires a register loop variable, got '${header.variable}'.`,
        'Use for R0 in range(...), for R1 in range(...), etc.'
      ));
      return;
    }

    const controlRow = header.control?.row ?? 0;
    const controlCol = header.control?.col ?? 0;
    const suffix = controlFlowCounter.value++;
    const startLabel = `__for_start_${suffix}`;
    const endLabel = `__for_end_${suffix}`;
    const loopKernel: KernelAst = {
      name: '__for_runtime_body__',
      config: undefined,
      cycles: [],
      directives: [],
      pragmas: [],
      span: spanAt(lineNo, 1, lineLength)
    };
    const loopCounter = { value: 0 };
    expandFunctionBodyIntoKernel(
      loopBody,
      loopKernel,
      functions,
      constants,
      diagnostics,
      loopCounter,
      callStack,
      expansionCounter,
      controlFlowCounter
    );
    const aggressivePlan = buildRuntimeNoUnrollAggressivePlan(
      loopKernel.cycles,
      header.variable,
      controlRow,
      controlCol
    );

    kernel.cycles.push(makeControlCycle(
      cycleCounter.value++,
      lineNo,
      controlRow,
      controlCol,
      `SADD ${header.variable}, ZERO, IMM(${header.start})`
    ));

    kernel.cycles.push(makeControlCycle(
      cycleCounter.value++,
      lineNo,
      controlRow,
      controlCol,
      buildRuntimeNoUnrollExitBranch(header.variable, header.end, endLabel, header.step),
      startLabel
    ));

    if (aggressivePlan) {
      const conditionCycle = kernel.cycles[kernel.cycles.length - 1];
      conditionCycle.statements.push({
        kind: 'at',
        row: aggressivePlan.bodyRow,
        col: aggressivePlan.bodyCol,
        instruction: parseInstruction(
          `SADD ${aggressivePlan.relayRegister}, ${aggressivePlan.incomingRegister}, ZERO`,
          lineNo,
          1
        ),
        span: spanAt(lineNo, 1, lineLength)
      });

      const jumpCol = chooseJumpColumn(controlCol, aggressivePlan.bodyCol);
      kernel.cycles.push({
        index: cycleCounter.value++,
        statements: [
          {
            kind: 'at',
            row: aggressivePlan.bodyRow,
            col: aggressivePlan.bodyCol,
            instruction: aggressivePlan.bodyInstruction,
            span: spanAt(lineNo, 1, lineLength)
          },
          {
            kind: 'at',
            row: controlRow,
            col: controlCol,
            instruction: parseInstruction(`SADD ${header.variable}, ${header.variable}, IMM(${header.step})`, lineNo, 1),
            span: spanAt(lineNo, 1, lineLength)
          },
          {
            kind: 'at',
            row: controlRow,
            col: jumpCol,
            instruction: parseInstruction(`JUMP ${startLabel}, ZERO`, lineNo, 1),
            span: spanAt(lineNo, 1, lineLength)
          }
        ],
        span: spanAt(lineNo, 1, lineLength)
      });
    } else {
      for (const cycle of loopKernel.cycles) {
        kernel.cycles.push(cloneCycle(cycle, cycleCounter.value++));
      }

      const jumpCol = chooseJumpColumn(controlCol);
      kernel.cycles.push({
        index: cycleCounter.value++,
        statements: [
          {
            kind: 'at',
            row: controlRow,
            col: controlCol,
            instruction: parseInstruction(`SADD ${header.variable}, ${header.variable}, IMM(${header.step})`, lineNo, 1),
            span: spanAt(lineNo, 1, lineLength)
          },
          {
            kind: 'at',
            row: controlRow,
            col: jumpCol,
            instruction: parseInstruction(`JUMP ${startLabel}, ZERO`, lineNo, 1),
            span: spanAt(lineNo, 1, lineLength)
          }
        ],
        span: spanAt(lineNo, 1, lineLength)
      });
    }

    kernel.cycles.push(makeControlCycle(
      cycleCounter.value++,
      lineNo,
      controlRow,
      controlCol,
      'NOP',
      endLabel
    ));
    return;
  }

  let values = enumerateForValues(header, lineNo, lineLength, diagnostics);
  if (!values) return;
  if (unrollFactor !== undefined) {
    values = values.slice(0, unrollFactor);
  }

  const perIterationCycles: CycleAst[][] = [];
  for (const value of values) {
    const bindings = new Map<string, number>();
    bindings.set(header.variable, value);
    const instantiated = instantiateEntriesWithBindings(loopBody, bindings);

    const tmpKernel: KernelAst = {
      name: '__for_iter__',
      config: undefined,
      cycles: [],
      directives: [],
      pragmas: [],
      span: spanAt(lineNo, 1, lineLength)
    };
    const tmpCounter = { value: 0 };
    const hasNestedFor = hasImmediateNestedForLoop(instantiated);
    const inheritedParallelCollapseLevels = (() => {
      if (!hasNestedFor) return undefined;
      const levels = pendingPragmas?.parallelCollapseLevels;
      if (levels === undefined) return undefined;
      if (!Number.isFinite(levels)) return Number.POSITIVE_INFINITY;
      if (levels <= 1) return undefined;
      return levels - 1;
    })();

    expandFunctionBodyIntoKernel(
      instantiated,
      tmpKernel,
      functions,
      constants,
      diagnostics,
      tmpCounter,
      callStack,
      expansionCounter,
      controlFlowCounter,
      inheritedParallelCollapseLevels === undefined
        ? null
        : { span: pendingPragmas?.span ?? spanAt(lineNo, 1, lineLength), parallelCollapseLevels: inheritedParallelCollapseLevels }
    );
    perIterationCycles.push(tmpKernel.cycles);
  }

  if (collapseRequested) {
    const hasControlFlow = perIterationCycles.some((iterCycles) => iterCycles.some(cycleHasControlFlow));
    if (hasControlFlow) {
      // Keep compatibility with v1: when control-flow exists, preserve semantics
      // by falling back to deterministic per-iteration expansion.
      for (const iterCycles of perIterationCycles) {
        for (const cycle of iterCycles) {
          kernel.cycles.push(cloneCycle(cycle, cycleCounter.value++));
        }
      }
      return;
    }

    const maxCycleCount = perIterationCycles.reduce((max, iter) => Math.max(max, iter.length), 0);
    for (let idx = 0; idx < maxCycleCount; idx++) {
      const statements: CycleAst['statements'] = [];
      let span: SourceSpan | null = null;
      for (const iterCycles of perIterationCycles) {
        const cycle = iterCycles[idx];
        if (!cycle) continue;
        if (!span) span = cycle.span;
        statements.push(...cycle.statements);
      }
      if (statements.length === 0) continue;
      kernel.cycles.push({
        index: cycleCounter.value++,
        statements,
        span: span ?? spanAt(lineNo, 1, lineLength)
      });
    }
    return;
  }

  for (const iterCycles of perIterationCycles) {
    for (const cycle of iterCycles) {
      kernel.cycles.push(cloneCycle(cycle, cycleCounter.value++));
    }
  }
}

function collectBlockFromSource(
  lines: string[],
  startIndex: number
): CollectedBlock {
  const body: SourceLineEntry[] = [];
  const header = stripLineComment(lines[startIndex]).trim();
  let depth = countChar(header, '{') - countChar(header, '}');
  if (depth <= 0) depth = 1;

  for (let i = startIndex + 1; i < lines.length; i++) {
    const rawLine = lines[i];
    const cleanLine = stripLineComment(rawLine).trim();
    if (depth === 1 && cleanLine.startsWith('}')) {
      return {
        body,
        endIndex: i,
        trailingAfterClose: cleanLine.slice(1).trim()
      };
    }

    const opens = countChar(cleanLine, '{');
    const closes = countChar(cleanLine, '}');
    const nextDepth = depth + opens - closes;

    if (nextDepth === 0) {
      return { body, endIndex: i };
    }

    body.push({
      lineNo: i + 1,
      rawLine,
      cleanLine
    });
    depth = nextDepth;
  }

  return { body, endIndex: null };
}

function collectBlockFromEntries(
  entries: SourceLineEntry[],
  startIndex: number
): CollectedBlock {
  const body: SourceLineEntry[] = [];
  const header = entries[startIndex].cleanLine;
  let depth = countChar(header, '{') - countChar(header, '}');
  if (depth <= 0) depth = 1;

  for (let i = startIndex + 1; i < entries.length; i++) {
    const cleanLine = entries[i].cleanLine;
    if (depth === 1 && cleanLine.startsWith('}')) {
      return {
        body,
        endIndex: i,
        trailingAfterClose: cleanLine.slice(1).trim()
      };
    }

    const opens = countChar(cleanLine, '{');
    const closes = countChar(cleanLine, '}');
    const nextDepth = depth + opens - closes;

    if (nextDepth === 0) {
      return { body, endIndex: i };
    }

    body.push(entries[i]);
    depth = nextDepth;
  }

  return { body, endIndex: null };
}

function collectBlockAfterOpenFromSource(lines: string[], startIndex: number): CollectedBlock {
  const body: SourceLineEntry[] = [];
  let depth = 1;

  for (let i = startIndex; i < lines.length; i++) {
    const rawLine = lines[i];
    const cleanLine = stripLineComment(rawLine).trim();
    if (depth === 1 && cleanLine.startsWith('}')) {
      return {
        body,
        endIndex: i,
        trailingAfterClose: cleanLine.slice(1).trim()
      };
    }

    const opens = countChar(cleanLine, '{');
    const closes = countChar(cleanLine, '}');
    const nextDepth = depth + opens - closes;

    body.push({
      lineNo: i + 1,
      rawLine,
      cleanLine
    });
    depth = nextDepth;
  }

  return { body, endIndex: null };
}

function collectBlockAfterOpenFromEntries(entries: SourceLineEntry[], startIndex: number): CollectedBlock {
  const body: SourceLineEntry[] = [];
  let depth = 1;

  for (let i = startIndex; i < entries.length; i++) {
    const cleanLine = entries[i].cleanLine;
    if (depth === 1 && cleanLine.startsWith('}')) {
      return {
        body,
        endIndex: i,
        trailingAfterClose: cleanLine.slice(1).trim()
      };
    }

    const opens = countChar(cleanLine, '{');
    const closes = countChar(cleanLine, '}');
    const nextDepth = depth + opens - closes;

    body.push(entries[i]);
    depth = nextDepth;
  }

  return { body, endIndex: null };
}

function expandLoopBody(
  body: SourceLineEntry[],
  constants: ReadonlyMap<string, number>,
  bindings: ReadonlyMap<string, number>,
  diagnostics: Diagnostic[]
): CycleStatementAst[] {
  const statements: CycleStatementAst[] = [];

  for (let i = 0; i < body.length; i++) {
    const entry = body[i];
    if (!entry.cleanLine) continue;

    const clean = applyBindings(entry.cleanLine, bindings);
    const raw = applyBindings(entry.rawLine, bindings);
    if (!clean) continue;

    const loopHeader = parseForHeader(clean, entry.lineNo, constants, bindings, diagnostics);
    if (loopHeader) {
      if (loopHeader.control) {
        diagnostics.push(makeDiagnostic(
          ErrorCodes.Parse.InvalidSyntax,
          'error',
          spanAt(entry.lineNo, 1, clean.length),
          'Control location @row,col is not supported for for-loops inside cycle blocks.',
          'Move the loop to kernel/function scope to use runtime-control syntax.'
        ));
        continue;
      }

      const nested = collectBlockFromEntries(body, i);
      if (nested.endIndex === null) {
        diagnostics.push(makeDiagnostic(
          ErrorCodes.Parse.InvalidSyntax,
          'error',
          spanAt(entry.lineNo, 1, clean.length),
          'Unterminated for loop inside cycle block.',
          'Add a closing brace for for { ... }.'
        ));
        break;
      }

      const shouldContinue = loopHeader.step > 0
        ? (v: number) => v < loopHeader.end
        : (v: number) => v > loopHeader.end;

      for (let value = loopHeader.start; shouldContinue(value); value += loopHeader.step) {
        const nestedBindings = new Map(bindings);
        nestedBindings.set(loopHeader.variable, value);
        statements.push(...expandLoopBody(nested.body, constants, nestedBindings, diagnostics));
      }

      i = nested.endIndex;
      continue;
    }

    if (clean === '}') {
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Parse.InvalidSyntax,
        'error',
        spanAt(entry.lineNo, 1, clean.length),
        'Unexpected closing brace inside cycle block.',
        'Check for mismatched braces around for/cycle blocks.'
      ));
      continue;
    }

    const statement = parseCycleStatement(clean, entry.lineNo, raw, constants, bindings);
    if (!statement) {
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Parse.InvalidSyntax,
        'error',
        spanAt(entry.lineNo, 1, clean.length),
        `Invalid cycle statement: '${clean}'`,
        'Expected @row,col:, row N:, col N:, all:, or for ... in range(...) { ... }.'
      ));
      continue;
    }

    statements.push(statement);
  }

  return statements;
}

function buildConstantMap(directives: DirectiveAst[], diagnostics: Diagnostic[]): Map<string, number> {
  const constants = new Map<string, number>();

  for (const directive of directives) {
    if (directive.kind !== 'const') continue;
    const value = evaluateNumericExpression(directive.value, constants, new Map());
    if (value === null) {
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Parse.InvalidSyntax,
        'error',
        directive.span,
        `Invalid numeric value for .const '${directive.name}': '${directive.value}'.`,
        'Use integer expressions referencing previously declared constants.'
      ));
      continue;
    }
    constants.set(directive.name, value);
  }

  return constants;
}

function parseFunctionHeader(cleanLine: string): { name: string; paramsText: string } | null {
  const match = cleanLine.match(/^function\s+([A-Za-z_][A-Za-z0-9_]*)\s*\((.*)\)\s*\{\s*$/i);
  if (!match) return null;
  return {
    name: match[1],
    paramsText: match[2].trim()
  };
}

function parseFunctionParams(
  paramsText: string,
  lineNo: number,
  diagnostics: Diagnostic[]
): string[] | null {
  if (!paramsText) return [];
  const parts = splitTopLevel(paramsText, ',').map((p) => p.trim()).filter(Boolean);
  const params: string[] = [];

  for (const part of parts) {
    const match = part.match(/^([A-Za-z_][A-Za-z0-9_]*)(?:\s*:\s*.+)?$/);
    if (!match) {
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Parse.InvalidSyntax,
        'error',
        spanAt(lineNo, 1, Math.max(1, paramsText.length)),
        `Invalid function parameter '${part}'.`,
        'Use parameter syntax: name or name: type.'
      ));
      return null;
    }

    const name = match[1];
    if (params.includes(name)) {
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Parse.InvalidSyntax,
        'error',
        spanAt(lineNo, 1, Math.max(1, paramsText.length)),
        `Duplicate function parameter '${name}'.`,
        'Each function parameter must be unique.'
      ));
      return null;
    }

    params.push(name);
  }

  return params;
}

function parseFunctionCallLine(cleanLine: string): { name: string; args: string[] } | null {
  const match = cleanLine.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*\((.*)\)\s*;?\s*$/);
  if (!match) return null;

  const argsText = match[2].trim();
  const args = argsText.length === 0
    ? []
    : splitTopLevel(argsText, ',').map((arg) => arg.trim());

  return {
    name: match[1],
    args
  };
}

function bindFunctionCallArgs(
  def: FunctionDefinitionLite,
  args: string[],
  callLineNo: number,
  diagnostics: Diagnostic[]
): Map<string, string> | null {
  const byParam = new Map<string, string>();
  let positionalIndex = 0;
  let seenNamed = false;

  for (const rawArg of args) {
    const named = rawArg.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.+)$/s);
    if (named && def.params.includes(named[1])) {
      const paramName = named[1];
      const value = named[2].trim();
      seenNamed = true;

      if (byParam.has(paramName)) {
        diagnostics.push(makeDiagnostic(
          ErrorCodes.Parse.InvalidSyntax,
          'error',
          spanAt(callLineNo, 1, 1),
          `Parameter '${paramName}' specified multiple times in call to '${def.name}'.`,
          'Specify each function parameter at most once.'
        ));
        return null;
      }

      byParam.set(paramName, value);
      continue;
    }

    if (seenNamed) {
      const usagePreview = def.params.length > 1
        ? `${def.name}(${def.params[0]}, ${def.params[1]}: value)`
        : `${def.name}(${def.params[0]}: value)`;
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Parse.InvalidSyntax,
        'error',
        spanAt(callLineNo, 1, 1),
        `Positional arguments must come before named arguments in call to '${def.name}'.`,
        `Use positional args first, then named args like ${usagePreview}.`
      ));
      return null;
    }

    if (positionalIndex >= def.params.length) {
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Parse.InvalidSyntax,
        'error',
        spanAt(callLineNo, 1, 1),
        `Function '${def.name}' expects ${def.params.length} argument(s), got ${args.length}.`,
        `Call it as: ${def.name}(${def.params.join(', ')})`
      ));
      return null;
    }

    byParam.set(def.params[positionalIndex], rawArg);
    positionalIndex++;
  }

  for (const param of def.params) {
    if (!byParam.has(param)) {
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Parse.InvalidSyntax,
        'error',
        spanAt(callLineNo, 1, 1),
        `Missing argument for parameter '${param}' in call to '${def.name}'.`,
        `Call it as: ${def.name}(${def.params.join(', ')})`
      ));
      return null;
    }
  }

  return byParam;
}

function parseLabeledCycleLine(cleanLine: string): ParsedLabeledCycle | null {
  const inline = cleanLine.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*cycle\s*\{\s*(.+)\s*\}\s*$/i);
  if (inline) {
    return {
      label: inline[1],
      inlinePayload: inline[2]
    };
  }

  const block = cleanLine.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*cycle\s*\{\s*$/i);
  if (block) {
    return {
      label: block[1]
    };
  }

  return null;
}

function parseConditionExpression(conditionText: string): ParsedCondition | null {
  const operators = ['==', '!=', '>=', '<=', '>', '<'] as const;
  let paren = 0;
  let bracket = 0;

  for (let i = 0; i < conditionText.length; i++) {
    const ch = conditionText[i];
    if (ch === '(') paren++;
    if (ch === ')') paren = Math.max(0, paren - 1);
    if (ch === '[') bracket++;
    if (ch === ']') bracket = Math.max(0, bracket - 1);
    if (paren !== 0 || bracket !== 0) continue;

    for (const op of operators) {
      if (!conditionText.startsWith(op, i)) continue;
      const lhs = conditionText.slice(0, i).trim();
      const rhs = conditionText.slice(i + op.length).trim();
      if (!lhs || !rhs) return null;
      return {
        lhs,
        operator: op,
        rhs
      };
    }
  }

  return null;
}

function parseControlHeader(
  cleanLine: string,
  keyword: 'if' | 'while',
  lineNo: number,
  constants: ReadonlyMap<string, number>,
  diagnostics: Diagnostic[]
): ParsedControlHeader | null {
  const regex = keyword === 'if'
    ? /^if\s*\((.+)\)\s*@\s*([^,]+)\s*,\s*([^\{]+)\{\s*$/i
    : /^while\s*\((.+)\)\s*@\s*([^,]+)\s*,\s*([^\{]+)\{\s*$/i;
  const match = cleanLine.match(regex);
  if (!match) return null;

  const parsedCondition = parseConditionExpression(match[1].trim());
  if (!parsedCondition) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      spanAt(lineNo, 1, cleanLine.length),
      `Invalid ${keyword} condition '${match[1].trim()}'.`,
      'Use condition syntax: <operand> <op> <operand>, where op is one of == != < <= > >='
    ));
    return null;
  }

  const row = evaluateNumericExpression(match[2].trim(), constants, new Map());
  const col = evaluateNumericExpression(match[3].trim(), constants, new Map());
  if (row === null || col === null) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      spanAt(lineNo, 1, cleanLine.length),
      `Invalid ${keyword} control location '@${match[2].trim()},${match[3].trim()}'.`,
      'Control location coordinates must evaluate to integers.'
    ));
    return null;
  }

  return {
    condition: parsedCondition,
    row,
    col
  };
}

function buildFalseBranchInstruction(
  condition: ParsedCondition,
  targetLabel: string
): string {
  switch (condition.operator) {
    case '==':
      return `BNE ${condition.lhs}, ${condition.rhs}, ${targetLabel}`;
    case '!=':
      return `BEQ ${condition.lhs}, ${condition.rhs}, ${targetLabel}`;
    case '<':
      return `BGE ${condition.lhs}, ${condition.rhs}, ${targetLabel}`;
    case '>=':
      return `BLT ${condition.lhs}, ${condition.rhs}, ${targetLabel}`;
    case '>':
      return `BGE ${condition.rhs}, ${condition.lhs}, ${targetLabel}`;
    case '<=':
      return `BLT ${condition.rhs}, ${condition.lhs}, ${targetLabel}`;
  }
}

function applyFunctionArgs(input: string, argsByParam: ReadonlyMap<string, string>): string {
  let out = input;
  for (const [name, value] of argsByParam.entries()) {
    const regex = new RegExp(`\\b${escapeRegExp(name)}\\b`, 'g');
    out = out.replace(regex, value);
  }
  return out;
}

function instantiateFunctionBody(
  def: FunctionDefinitionLite,
  args: string[],
  callLineNo: number,
  diagnostics: Diagnostic[],
  expansionCounter: { value: number }
): SourceLineEntry[] | null {
  const argsByParam = bindFunctionCallArgs(def, args, callLineNo, diagnostics);
  if (!argsByParam) return null;

  const expansionId = expansionCounter.value++;
  const labelMap = new Map<string, string>();
  const labelPattern = /^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*cycle\b/i;
  for (const entry of def.body) {
    const match = entry.cleanLine.match(labelPattern);
    if (!match) continue;
    const original = match[1];
    if (!labelMap.has(original)) {
      labelMap.set(original, `__fn_${def.name}_${expansionId}_${original}`);
    }
  }

  return def.body.map((entry) => {
    let raw = applyFunctionArgs(entry.rawLine, argsByParam);
    let clean = applyFunctionArgs(entry.cleanLine, argsByParam);

    for (const [original, renamed] of labelMap.entries()) {
      const regex = new RegExp(`\\b${escapeRegExp(original)}\\b`, 'g');
      raw = raw.replace(regex, renamed);
      clean = clean.replace(regex, renamed);
    }

    return {
      lineNo: callLineNo,
      rawLine: raw,
      cleanLine: clean
    };
  });
}

function parseInlineCycleStatements(
  payload: string,
  lineNo: number,
  constants: ReadonlyMap<string, number>,
  diagnostics: Diagnostic[]
): CycleStatementAst[] {
  const statements: CycleStatementAst[] = [];
  const parts = splitTopLevel(payload, ';').map((p) => p.trim()).filter(Boolean);
  for (const part of parts) {
    const cleanStmt = `${part};`;
    const parsed = parseCycleStatement(cleanStmt, lineNo, cleanStmt, constants, new Map());
    if (!parsed) {
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Parse.InvalidSyntax,
        'error',
        spanAt(lineNo, 1, cleanStmt.length),
        `Invalid inline cycle statement: '${part}'.`,
        'Use valid cycle placement syntax like @r,c:, row:, col:, or all:.'
      ));
      continue;
    }
    statements.push(parsed);
  }
  return statements;
}

function makeControlCycle(
  index: number,
  lineNo: number,
  row: number,
  col: number,
  instructionText: string,
  label?: string
): CycleAst {
  const statementText = `@${row},${col}: ${instructionText};`;
  return {
    index,
    label,
    statements: [{
      kind: 'at',
      row,
      col,
      instruction: parseInstruction(instructionText, lineNo, 1),
      span: spanAt(lineNo, 1, statementText.length)
    }],
    span: spanAt(lineNo, 1, statementText.length)
  };
}

function isElseOpenLine(cleanLine: string): boolean {
  return /^else\s*\{\s*$/i.test(cleanLine);
}

function expandFunctionBodyIntoKernel(
  body: SourceLineEntry[],
  kernel: KernelAst,
  functions: ReadonlyMap<string, FunctionDefinitionLite>,
  constants: ReadonlyMap<string, number>,
  diagnostics: Diagnostic[],
  cycleCounter: { value: number },
  callStack: string[],
  expansionCounter: { value: number },
  controlFlowCounter: { value: number },
  initialPendingControlPragmas: PendingControlPragmas | null = null
): void {
  let pendingControlPragmas: PendingControlPragmas | null = initialPendingControlPragmas
    ? { ...initialPendingControlPragmas }
    : null;

  for (let i = 0; i < body.length; i++) {
    const entry = body[i];
    const clean = entry.cleanLine.trim();
    if (!clean) continue;

    const controlPragma = parseControlPragma(clean, entry.lineNo, diagnostics);
    if (controlPragma.consumed) {
      if (controlPragma.pragma) {
        pendingControlPragmas = applyControlPragma(pendingControlPragmas, controlPragma.pragma);
      }
      continue;
    }

    const forHeader = parseForHeader(clean, entry.lineNo, constants, new Map(), diagnostics);
    if (forHeader) {
      const loopBlock = collectBlockFromEntries(body, i);
      if (loopBlock.endIndex === null) {
        diagnostics.push(makeDiagnostic(
          ErrorCodes.Parse.InvalidSyntax,
          'error',
          spanAt(entry.lineNo, 1, clean.length),
          'Unterminated for block.',
          'Add a closing brace for for { ... }.'
        ));
        break;
      }

      if (pendingControlPragmas?.noFuse) {
        diagnostics.push(makeDiagnostic(
          ErrorCodes.Parse.InvalidSyntax,
          'error',
          pendingControlPragmas.span,
          '#pragma no_fuse can only be applied to while loops.',
          'Move #pragma no_fuse directly above a while (...) block.'
        ));
      }

      expandForLoopIntoKernel(
        forHeader,
        loopBlock.body,
        entry.lineNo,
        clean.length,
        kernel,
        functions,
        constants,
        diagnostics,
        cycleCounter,
        callStack,
        expansionCounter,
        controlFlowCounter,
        pendingControlPragmas
      );
      pendingControlPragmas = null;
      i = loopBlock.endIndex;
      continue;
    }

    const ifHeader = parseControlHeader(clean, 'if', entry.lineNo, constants, diagnostics);
    if (ifHeader) {
      if (hasAnyPendingPragmas(pendingControlPragmas)) {
        diagnostics.push(makeDiagnostic(
          ErrorCodes.Parse.InvalidSyntax,
          'error',
          pendingControlPragmas!.span,
          `Pragma(s) ${describePendingPragmas(pendingControlPragmas)} must be followed by a compatible loop.`,
          'Use unroll/no_unroll/parallel with for, and no_fuse with while.'
        ));
        pendingControlPragmas = null;
      }

      const thenBlock = collectBlockFromEntries(body, i);
      if (thenBlock.endIndex === null) {
        diagnostics.push(makeDiagnostic(
          ErrorCodes.Parse.InvalidSyntax,
          'error',
          spanAt(entry.lineNo, 1, clean.length),
          'Unterminated if block.',
          'Add a closing brace for if { ... }.'
        ));
        break;
      }

      const suffixId = controlFlowCounter.value++;
      const elseLabel = `__if_else_${suffixId}`;
      const endLabel = `__if_end_${suffixId}`;

      let hasElse = false;
      let elseBlock: CollectedBlock | null = null;
      let consumedEnd = thenBlock.endIndex;

      if (thenBlock.trailingAfterClose && isElseOpenLine(thenBlock.trailingAfterClose)) {
        hasElse = true;
        elseBlock = collectBlockAfterOpenFromEntries(body, thenBlock.endIndex + 1);
        if (elseBlock.endIndex === null) {
          diagnostics.push(makeDiagnostic(
            ErrorCodes.Parse.InvalidSyntax,
            'error',
            spanAt(entry.lineNo, 1, clean.length),
            'Unterminated else block.',
            'Add a closing brace for else { ... }.'
          ));
          break;
        }
        consumedEnd = elseBlock.endIndex;
      } else {
        const maybeElseIndex = thenBlock.endIndex + 1;
        if (maybeElseIndex < body.length && isElseOpenLine(body[maybeElseIndex].cleanLine)) {
          hasElse = true;
          elseBlock = collectBlockFromEntries(body, maybeElseIndex);
          if (elseBlock.endIndex === null) {
            diagnostics.push(makeDiagnostic(
              ErrorCodes.Parse.InvalidSyntax,
              'error',
              spanAt(body[maybeElseIndex].lineNo, 1, body[maybeElseIndex].cleanLine.length),
              'Unterminated else block.',
              'Add a closing brace for else { ... }.'
            ));
            break;
          }
          consumedEnd = elseBlock.endIndex;
        }
      }

      const falseTarget = hasElse ? elseLabel : endLabel;
      kernel.cycles.push(makeControlCycle(
        cycleCounter.value++,
        entry.lineNo,
        ifHeader.row,
        ifHeader.col,
        buildFalseBranchInstruction(ifHeader.condition, falseTarget)
      ));

      expandFunctionBodyIntoKernel(
        thenBlock.body,
        kernel,
        functions,
        constants,
        diagnostics,
        cycleCounter,
        callStack,
        expansionCounter,
        controlFlowCounter
      );

      if (hasElse && elseBlock) {
        kernel.cycles.push(makeControlCycle(
          cycleCounter.value++,
          entry.lineNo,
          ifHeader.row,
          ifHeader.col,
          `JUMP ${endLabel}, ZERO`
        ));

        kernel.cycles.push(makeControlCycle(
          cycleCounter.value++,
          entry.lineNo,
          ifHeader.row,
          ifHeader.col,
          'NOP',
          elseLabel
        ));

        expandFunctionBodyIntoKernel(
          elseBlock.body,
          kernel,
          functions,
          constants,
          diagnostics,
          cycleCounter,
          callStack,
          expansionCounter,
          controlFlowCounter
        );
      }

      kernel.cycles.push(makeControlCycle(
        cycleCounter.value++,
        entry.lineNo,
        ifHeader.row,
        ifHeader.col,
        'NOP',
        endLabel
      ));

      i = consumedEnd;
      continue;
    }

    const whileHeader = parseControlHeader(clean, 'while', entry.lineNo, constants, diagnostics);
    if (whileHeader) {
      const disableFuse = pendingControlPragmas?.noFuse === true;
      if (hasForScopedPragmas(pendingControlPragmas)) {
        diagnostics.push(makeDiagnostic(
          ErrorCodes.Parse.InvalidSyntax,
          'error',
          pendingControlPragmas!.span,
          `Pragma(s) ${describePendingPragmas(pendingControlPragmas)} cannot be applied to while loops.`,
          'Use #pragma no_fuse for while loops, or move unroll/parallel pragmas before for loops.'
        ));
      }
      pendingControlPragmas = null;

      const loopBlock = collectBlockFromEntries(body, i);
      if (loopBlock.endIndex === null) {
        diagnostics.push(makeDiagnostic(
          ErrorCodes.Parse.InvalidSyntax,
          'error',
          spanAt(entry.lineNo, 1, clean.length),
          'Unterminated while block.',
          'Add a closing brace for while { ... }.'
        ));
        break;
      }

      const suffixId = controlFlowCounter.value++;
      const startLabel = `__while_start_${suffixId}`;
      const endLabel = `__while_end_${suffixId}`;
      const loopKernel: KernelAst = {
        name: '__while_body__',
        config: undefined,
        cycles: [],
        directives: [],
        pragmas: [],
        span: spanAt(entry.lineNo, 1, clean.length)
      };
      const loopCounter = { value: 0 };
      expandFunctionBodyIntoKernel(
        loopBlock.body,
        loopKernel,
        functions,
        constants,
        diagnostics,
        loopCounter,
        callStack,
        expansionCounter,
        controlFlowCounter
      );

      const fusionPlan = !disableFuse
        ? buildWhileFusionPlan(loopKernel.cycles, whileHeader.row, whileHeader.col)
        : null;
      const branchCondition = fusionPlan
        ? rewriteConditionForWhileFusion(whileHeader.condition, fusionPlan.incomingRegister)
        : whileHeader.condition;

      kernel.cycles.push(makeControlCycle(
        cycleCounter.value++,
        entry.lineNo,
        whileHeader.row,
        whileHeader.col,
        buildFalseBranchInstruction(branchCondition, endLabel),
        startLabel
      ));

      for (const cycle of loopKernel.cycles) {
        kernel.cycles.push(cloneCycle(cycle, cycleCounter.value++));
      }

      let fusedBackEdge = false;
      if (fusionPlan) {
        const jumpText = `JUMP ${startLabel}, ZERO`;
        kernel.cycles[kernel.cycles.length - 1].statements.push({
          kind: 'at',
          row: whileHeader.row,
          col: whileHeader.col,
          instruction: parseInstruction(jumpText, entry.lineNo, 1),
          span: spanAt(entry.lineNo, 1, jumpText.length)
        });
        fusedBackEdge = true;
      }

      if (!fusedBackEdge) {
        kernel.cycles.push(makeControlCycle(
          cycleCounter.value++,
          entry.lineNo,
          whileHeader.row,
          whileHeader.col,
          `JUMP ${startLabel}, ZERO`
        ));
      }

      kernel.cycles.push(makeControlCycle(
        cycleCounter.value++,
        entry.lineNo,
        whileHeader.row,
        whileHeader.col,
        'NOP',
        endLabel
      ));

      i = loopBlock.endIndex;
      continue;
    }

    if (hasAnyPendingPragmas(pendingControlPragmas)) {
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Parse.InvalidSyntax,
        'error',
        pendingControlPragmas!.span,
        `Pragma(s) ${describePendingPragmas(pendingControlPragmas)} must be followed by a compatible loop.`,
        'Use unroll/no_unroll/parallel with for, and no_fuse with while.'
      ));
      pendingControlPragmas = null;
    }

    const labeledCycle = parseLabeledCycleLine(clean);
    if (labeledCycle && labeledCycle.inlinePayload !== undefined) {
      const cycle: CycleAst = {
        index: cycleCounter.value++,
        label: labeledCycle.label,
        statements: parseInlineCycleStatements(labeledCycle.inlinePayload, entry.lineNo, constants, diagnostics),
        span: spanAt(entry.lineNo, 1, clean.length)
      };
      kernel.cycles.push(cycle);
      continue;
    }

    if (labeledCycle) {
      const block = collectBlockFromEntries(body, i);
      if (block.endIndex === null) {
        diagnostics.push(makeDiagnostic(
          ErrorCodes.Parse.InvalidSyntax,
          'error',
          spanAt(entry.lineNo, 1, clean.length),
          `Unterminated labeled cycle '${labeledCycle.label}' inside function body.`,
          'Add a closing brace for cycle { ... }.'
        ));
        break;
      }

      kernel.cycles.push({
        index: cycleCounter.value++,
        label: labeledCycle.label,
        statements: expandLoopBody(block.body, constants, new Map(), diagnostics),
        span: spanAt(entry.lineNo, 1, clean.length)
      });
      i = block.endIndex;
      continue;
    }

    const inlineCycleMatch = clean.match(/^cycle\s*\{\s*(.+)\s*\}\s*$/i);
    if (inlineCycleMatch) {
      const cycle: CycleAst = {
        index: cycleCounter.value++,
        statements: parseInlineCycleStatements(inlineCycleMatch[1], entry.lineNo, constants, diagnostics),
        span: spanAt(entry.lineNo, 1, clean.length)
      };
      kernel.cycles.push(cycle);
      continue;
    }

    if (/^cycle\s*\{\s*$/i.test(clean)) {
      const block = collectBlockFromEntries(body, i);
      if (block.endIndex === null) {
        diagnostics.push(makeDiagnostic(
          ErrorCodes.Parse.InvalidSyntax,
          'error',
          spanAt(entry.lineNo, 1, clean.length),
          'Unterminated cycle block inside function body.',
          'Add a closing brace for cycle { ... }.'
        ));
        break;
      }

      kernel.cycles.push({
        index: cycleCounter.value++,
        statements: expandLoopBody(block.body, constants, new Map(), diagnostics),
        span: spanAt(entry.lineNo, 1, clean.length)
      });
      i = block.endIndex;
      continue;
    }

    const nestedCall = parseFunctionCallLine(clean);
    if (nestedCall && functions.has(nestedCall.name)) {
      if (callStack.includes(nestedCall.name)) {
        diagnostics.push(makeDiagnostic(
          ErrorCodes.Parse.InvalidSyntax,
          'error',
          spanAt(entry.lineNo, 1, clean.length),
          `Recursive function call detected: ${[...callStack, nestedCall.name].join(' -> ')}.`,
          'Recursive function expansion is not supported.'
        ));
        continue;
      }

      const def = functions.get(nestedCall.name)!;
      const instantiated = instantiateFunctionBody(def, nestedCall.args, entry.lineNo, diagnostics, expansionCounter);
      if (!instantiated) continue;

      expandFunctionBodyIntoKernel(
        instantiated,
        kernel,
        functions,
        constants,
        diagnostics,
        cycleCounter,
        [...callStack, nestedCall.name],
        expansionCounter,
        controlFlowCounter
      );
      continue;
    }

    diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      spanAt(entry.lineNo, 1, clean.length),
      `Unsupported function body statement: '${clean}'.`,
      'Function bodies currently support pragmas, for/while/if control-flow, cycle blocks, labeled cycles, and function calls.'
    ));
  }

  if (hasAnyPendingPragmas(pendingControlPragmas)) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      pendingControlPragmas!.span,
      `Pragma(s) ${describePendingPragmas(pendingControlPragmas)} are not followed by a loop.`,
      'Place control pragmas directly before for/while statements.'
    ));
  }
}

export function parseSource(source: string): ParseResult {
  const diagnostics: Diagnostic[] = [];
  const lines = source.split(/\r?\n/);

  const span: SourceSpan = {
    startLine: 1,
    startColumn: 1,
    endLine: lines.length,
    endColumn: (lines[lines.length - 1] || '').length + 1
  };

  const ast: AstProgram = {
    targetProfileId: null,
    kernel: null,
    span
  };

  let kernel: KernelAst | null = null;
  let kernelConstants = new Map<string, number>();
  let inKernel = false;
  let inCycle = false;
  let currentCycle: CycleAst | null = null;
  let autoCycleActive = false;
  let autoCycleCurrent: CycleAst | null = null;
  let autoCycleOccupancy = createAutoCycleOccupancy();
  let cycleConstants = new Map<string, number>();
  let cycleIndex = 0;
  const functionExpansionCounter = { value: 0 };
  const controlFlowCounter = { value: 0 };
  const pendingDirectives: DirectiveAst[] = [];
  const functions = new Map<string, FunctionDefinitionLite>();
  let pendingControlPragmas: PendingControlPragmas | null = null;

  const flushAutoCycleCurrent = (): void => {
    if (kernel && autoCycleCurrent) {
      kernel.cycles.push(autoCycleCurrent);
    }
    autoCycleCurrent = null;
    autoCycleOccupancy = createAutoCycleOccupancy();
  };

  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    const rawLine = lines[i];
    const clean = stripLineComment(rawLine).trim();

    if (!clean) continue;

    if (!inKernel) {
      const topPragma = clean.match(/^#pragma\s+([A-Za-z_][A-Za-z0-9_]*)(?:\s+.*)?$/i);
      if (topPragma) {
        const pragmaName = topPragma[1].toLowerCase();
        if (pragmaName === 'inline') {
          // Functions are inlined by default in v1/v2. Accept top-level pragma for compatibility.
          continue;
        }

        diagnostics.push(makeDiagnostic(
          ErrorCodes.Parse.InvalidSyntax,
          'error',
          spanAt(lineNo, 1, clean.length),
          `Unexpected top-level pragma '${clean}'.`,
          'Only #pragma inline is allowed at top level before function declarations.'
        ));
        continue;
      }

      const functionHeader = parseFunctionHeader(clean);
      if (functionHeader) {
        const params = parseFunctionParams(functionHeader.paramsText, lineNo, diagnostics);
        const block = collectBlockFromSource(lines, i);
        if (block.endIndex === null) {
          diagnostics.push(makeDiagnostic(
            ErrorCodes.Parse.InvalidSyntax,
            'error',
            spanAt(lineNo, 1, clean.length),
            `Unterminated function '${functionHeader.name}'.`,
            'Add a closing brace for function { ... }.'
          ));
          break;
        }

        if (params && !functions.has(functionHeader.name)) {
          functions.set(functionHeader.name, {
            name: functionHeader.name,
            params,
            body: block.body,
            span: spanAt(lineNo, 1, clean.length)
          });
        } else if (params) {
          diagnostics.push(makeDiagnostic(
            ErrorCodes.Parse.InvalidSyntax,
            'error',
            spanAt(lineNo, 1, clean.length),
            `Duplicate function definition '${functionHeader.name}'.`,
            'Use unique function names.'
          ));
        }

        i = block.endIndex;
        continue;
      }

      const targetMatch = clean.match(/^target\s+"([^"]+)"\s*;?\s*$/i);
      if (targetMatch) {
        ast.targetProfileId = targetMatch[1];
        continue;
      }

      const kernelMatch = clean.match(/^kernel\s+"([^"]+)"\s*\{\s*$/i);
      if (kernelMatch) {
        const initialDirectives = [...pendingDirectives];
        kernel = {
          name: kernelMatch[1],
          config: undefined,
          cycles: [],
          directives: initialDirectives,
          pragmas: [],
          span: spanAt(lineNo, 1, clean.length)
        };
        kernelConstants = buildConstantMap(initialDirectives, diagnostics);
        ast.kernel = kernel;
        pendingDirectives.length = 0;
        inKernel = true;
        continue;
      }

      const topDirective = parseDirective(clean, lineNo);
      if (topDirective) {
        if (!ast.kernel) {
          pendingDirectives.push(topDirective);
          continue;
        }

        diagnostics.push(makeDiagnostic(
          ErrorCodes.Parse.InvalidSyntax,
          'error',
          spanAt(lineNo, 1, clean.length),
          `Unexpected top-level directive after kernel declaration: '${clean}'`,
          'Move directives into kernel block or place them before kernel declaration.'
        ));
        continue;
      }

      diagnostics.push(makeDiagnostic(
        ErrorCodes.Parse.InvalidSyntax,
        'error',
        spanAt(lineNo, 1, clean.length),
        `Unexpected top-level statement: '${clean}'`,
        'Expected target declaration or kernel block.'
      ));
      continue;
    }

    if (inKernel && !inCycle) {
      if (clean === '}') {
        if (hasAnyPendingPragmas(pendingControlPragmas)) {
          diagnostics.push(makeDiagnostic(
            ErrorCodes.Parse.InvalidSyntax,
            'error',
            pendingControlPragmas!.span,
            `Pragma(s) ${describePendingPragmas(pendingControlPragmas)} are not followed by a loop.`,
            'Place control pragmas directly before for/while statements.'
          ));
          pendingControlPragmas = null;
        }

        if (autoCycleActive) {
          diagnostics.push(makeDiagnostic(
            ErrorCodes.Parse.InvalidSyntax,
            'error',
            spanAt(lineNo, 1, clean.length),
            '#pragma auto_cycle without matching #pragma end_auto_cycle.',
            'Close the region with #pragma end_auto_cycle before ending the kernel.'
          ));
          flushAutoCycleCurrent();
          autoCycleActive = false;
        }
        inKernel = false;
        continue;
      }

      const configMatch = clean.match(/^config\s*\(\s*([^,]+)\s*,\s*([^\)]+)\)\s*;?\s*$/i);
      if (configMatch && kernel) {
        kernel.config = {
          mask: parseNumber(configMatch[1]),
          startAddr: parseNumber(configMatch[2]),
          span: spanAt(lineNo, 1, clean.length)
        };
        continue;
      }

      const pragmaMatch = clean.match(/^#pragma\s+([A-Za-z_][A-Za-z0-9_]*)/i);
      if (pragmaMatch && kernel) {
        const pragmaName = pragmaMatch[1].toLowerCase();
        if (pragmaName === 'auto_cycle') {
          if (autoCycleActive) {
            diagnostics.push(makeDiagnostic(
              ErrorCodes.Parse.InvalidSyntax,
              'error',
              spanAt(lineNo, 1, clean.length),
              'Nested #pragma auto_cycle regions are not supported.',
              'Close the current region with #pragma end_auto_cycle before opening another.'
            ));
          } else {
            autoCycleActive = true;
            autoCycleCurrent = null;
            autoCycleOccupancy = createAutoCycleOccupancy();
          }
          continue;
        }

        if (pragmaName === 'end_auto_cycle') {
          if (!autoCycleActive) {
            diagnostics.push(makeDiagnostic(
              ErrorCodes.Parse.InvalidSyntax,
              'error',
              spanAt(lineNo, 1, clean.length),
              'Found #pragma end_auto_cycle without matching #pragma auto_cycle.',
              'Open an auto-cycle region before closing it.'
            ));
          } else {
            flushAutoCycleCurrent();
            autoCycleActive = false;
          }
          continue;
        }

        if (autoCycleActive) {
          diagnostics.push(makeDiagnostic(
            ErrorCodes.Parse.InvalidSyntax,
            'error',
            spanAt(lineNo, 1, clean.length),
            `Unsupported pragma '${pragmaName}' inside #pragma auto_cycle region.`,
            'Only PE-prefixed instructions and #pragma end_auto_cycle are allowed in this region.'
          ));
          continue;
        }

        const parsedControlPragma = parseControlPragma(clean, lineNo, diagnostics);
        if (parsedControlPragma.consumed) {
          if (parsedControlPragma.pragma) {
            pendingControlPragmas = applyControlPragma(pendingControlPragmas, parsedControlPragma.pragma);
          }
          continue;
        }

        kernel.pragmas.push({
          text: clean,
          span: spanAt(lineNo, 1, clean.length)
        });
        continue;
      }

      const directive = parseDirective(clean, lineNo);
      if (directive && kernel) {
        if (autoCycleActive) {
          diagnostics.push(makeDiagnostic(
            ErrorCodes.Parse.InvalidSyntax,
            'error',
            spanAt(lineNo, 1, clean.length),
            `Unsupported directive '${clean}' inside #pragma auto_cycle region.`,
            'Only PE-prefixed instructions and #pragma end_auto_cycle are allowed in this region.'
          ));
          continue;
        }

        kernel.directives.push(directive);
        if (directive.kind === 'const') {
          const value = evaluateNumericExpression(directive.value, kernelConstants, new Map());
          if (value === null) {
            diagnostics.push(makeDiagnostic(
              ErrorCodes.Parse.InvalidSyntax,
              'error',
              directive.span,
              `Invalid numeric value for .const '${directive.name}': '${directive.value}'.`,
              'Use integer expressions referencing previously declared constants.'
            ));
          } else {
            kernelConstants.set(directive.name, value);
          }
        }
        continue;
      }

      if (autoCycleActive && kernel) {
        const statement = parseCycleStatement(clean, lineNo, rawLine, kernelConstants, new Map());
        if (!statement) {
          diagnostics.push(makeDiagnostic(
            ErrorCodes.Parse.InvalidSyntax,
            'error',
            spanAt(lineNo, 1, clean.length),
            `Invalid auto_cycle statement: '${clean}'.`,
            'Use PE-prefixed instructions like @r,c:, row N:, col N:, or all:.'
          ));
          continue;
        }

        if (!autoCycleCurrent) {
          autoCycleCurrent = {
            index: cycleIndex++,
            statements: [],
            span: spanAt(lineNo, 1, clean.length)
          };
        }

        if (autoCycleHasConflict(statement, autoCycleOccupancy)) {
          flushAutoCycleCurrent();
          autoCycleCurrent = {
            index: cycleIndex++,
            statements: [],
            span: spanAt(lineNo, 1, clean.length)
          };
        }

        autoCycleCurrent.statements.push(statement);
        markAutoCycleOccupancy(statement, autoCycleOccupancy);
        continue;
      }

      const forHeader = parseForHeader(clean, lineNo, kernelConstants, new Map(), diagnostics);
      if (forHeader && kernel) {
        const loopBlock = collectBlockFromSource(lines, i);
        if (loopBlock.endIndex === null) {
          diagnostics.push(makeDiagnostic(
            ErrorCodes.Parse.InvalidSyntax,
            'error',
            spanAt(lineNo, 1, clean.length),
            'Unterminated for block.',
            'Add a closing brace for for { ... }.'
          ));
          break;
        }

        if (pendingControlPragmas?.noFuse) {
          diagnostics.push(makeDiagnostic(
            ErrorCodes.Parse.InvalidSyntax,
            'error',
            pendingControlPragmas.span,
            '#pragma no_fuse can only be applied to while loops.',
            'Move #pragma no_fuse directly above a while (...) block.'
          ));
        }

        const cycleCounter = { value: cycleIndex };
        expandForLoopIntoKernel(
          forHeader,
          loopBlock.body,
          lineNo,
          clean.length,
          kernel,
          functions,
          kernelConstants,
          diagnostics,
          cycleCounter,
          [],
          functionExpansionCounter,
          controlFlowCounter,
          pendingControlPragmas
        );
        cycleIndex = cycleCounter.value;
        pendingControlPragmas = null;
        i = loopBlock.endIndex;
        continue;
      }

      const inlineCycleMatch = clean.match(/^cycle\s*\{\s*(.+)\s*\}\s*$/i);
      if (inlineCycleMatch && kernel) {
        if (hasAnyPendingPragmas(pendingControlPragmas)) {
          diagnostics.push(makeDiagnostic(
            ErrorCodes.Parse.InvalidSyntax,
            'error',
            pendingControlPragmas!.span,
            `Pragma(s) ${describePendingPragmas(pendingControlPragmas)} must be followed by a compatible loop.`,
            'Use unroll/no_unroll/parallel with for, and no_fuse with while.'
          ));
          pendingControlPragmas = null;
        }

        const statements = parseInlineCycleStatements(
          inlineCycleMatch[1],
          lineNo,
          kernelConstants,
          diagnostics
        );
        kernel.cycles.push({
          index: cycleIndex++,
          statements,
          span: spanAt(lineNo, 1, clean.length)
        });
        continue;
      }

      const labeledCycle = parseLabeledCycleLine(clean);
      if (labeledCycle && labeledCycle.inlinePayload !== undefined && kernel) {
        if (hasAnyPendingPragmas(pendingControlPragmas)) {
          diagnostics.push(makeDiagnostic(
            ErrorCodes.Parse.InvalidSyntax,
            'error',
            pendingControlPragmas!.span,
            `Pragma(s) ${describePendingPragmas(pendingControlPragmas)} must be followed by a compatible loop.`,
            'Use unroll/no_unroll/parallel with for, and no_fuse with while.'
          ));
          pendingControlPragmas = null;
        }

        kernel.cycles.push({
          index: cycleIndex++,
          label: labeledCycle.label,
          statements: parseInlineCycleStatements(labeledCycle.inlinePayload, lineNo, kernelConstants, diagnostics),
          span: spanAt(lineNo, 1, clean.length)
        });
        continue;
      }

      if (labeledCycle && kernel) {
        if (hasAnyPendingPragmas(pendingControlPragmas)) {
          diagnostics.push(makeDiagnostic(
            ErrorCodes.Parse.InvalidSyntax,
            'error',
            pendingControlPragmas!.span,
            `Pragma(s) ${describePendingPragmas(pendingControlPragmas)} must be followed by a compatible loop.`,
            'Use unroll/no_unroll/parallel with for, and no_fuse with while.'
          ));
          pendingControlPragmas = null;
        }

        const block = collectBlockFromSource(lines, i);
        if (block.endIndex === null) {
          diagnostics.push(makeDiagnostic(
            ErrorCodes.Parse.InvalidSyntax,
            'error',
            spanAt(lineNo, 1, clean.length),
            `Unterminated labeled cycle '${labeledCycle.label}'.`,
            'Add a closing brace for cycle { ... }.'
          ));
          break;
        }

        kernel.cycles.push({
          index: cycleIndex++,
          label: labeledCycle.label,
          statements: expandLoopBody(block.body, kernelConstants, new Map(), diagnostics),
          span: spanAt(lineNo, 1, clean.length)
        });
        i = block.endIndex;
        continue;
      }

      if (/^cycle\s*\{\s*$/i.test(clean)) {
        if (hasAnyPendingPragmas(pendingControlPragmas)) {
          diagnostics.push(makeDiagnostic(
            ErrorCodes.Parse.InvalidSyntax,
            'error',
            pendingControlPragmas!.span,
            `Pragma(s) ${describePendingPragmas(pendingControlPragmas)} must be followed by a compatible loop.`,
            'Use unroll/no_unroll/parallel with for, and no_fuse with while.'
          ));
          pendingControlPragmas = null;
        }

        inCycle = true;
        cycleConstants = new Map(kernelConstants);
        currentCycle = {
          index: cycleIndex++,
          statements: [],
          span: spanAt(lineNo, 1, clean.length)
        };
        continue;
      }

      const functionCall = parseFunctionCallLine(clean);
      if (functionCall && functions.has(functionCall.name) && kernel) {
        if (hasAnyPendingPragmas(pendingControlPragmas)) {
          diagnostics.push(makeDiagnostic(
            ErrorCodes.Parse.InvalidSyntax,
            'error',
            pendingControlPragmas!.span,
            `Pragma(s) ${describePendingPragmas(pendingControlPragmas)} must be followed by a compatible loop.`,
            'Use unroll/no_unroll/parallel with for, and no_fuse with while.'
          ));
          pendingControlPragmas = null;
        }

        const def = functions.get(functionCall.name)!;
        const instantiated = instantiateFunctionBody(def, functionCall.args, lineNo, diagnostics, functionExpansionCounter);
        if (instantiated) {
          const cycleCounter = { value: cycleIndex };
          expandFunctionBodyIntoKernel(
            instantiated,
            kernel,
            functions,
            kernelConstants,
            diagnostics,
            cycleCounter,
            [functionCall.name],
            functionExpansionCounter,
            controlFlowCounter
          );
          cycleIndex = cycleCounter.value;
        }
        continue;
      }

      const ifHeader = parseControlHeader(clean, 'if', lineNo, kernelConstants, diagnostics);
      if (ifHeader && kernel) {
        if (hasAnyPendingPragmas(pendingControlPragmas)) {
          diagnostics.push(makeDiagnostic(
            ErrorCodes.Parse.InvalidSyntax,
            'error',
            pendingControlPragmas!.span,
            `Pragma(s) ${describePendingPragmas(pendingControlPragmas)} must be followed by a compatible loop.`,
            'Use unroll/no_unroll/parallel with for, and no_fuse with while.'
          ));
          pendingControlPragmas = null;
        }

        const thenBlock = collectBlockFromSource(lines, i);
        if (thenBlock.endIndex === null) {
          diagnostics.push(makeDiagnostic(
            ErrorCodes.Parse.InvalidSyntax,
            'error',
            spanAt(lineNo, 1, clean.length),
            'Unterminated if block.',
            'Add a closing brace for if { ... }.'
          ));
          break;
        }

        const suffixId = controlFlowCounter.value++;
        const elseLabel = `__if_else_${suffixId}`;
        const endLabel = `__if_end_${suffixId}`;

        let hasElse = false;
        let elseBlock: CollectedBlock | null = null;
        let consumedEnd = thenBlock.endIndex;

        if (thenBlock.trailingAfterClose && isElseOpenLine(thenBlock.trailingAfterClose)) {
          hasElse = true;
          elseBlock = collectBlockAfterOpenFromSource(lines, thenBlock.endIndex + 1);
          if (elseBlock.endIndex === null) {
            diagnostics.push(makeDiagnostic(
              ErrorCodes.Parse.InvalidSyntax,
              'error',
              spanAt(lineNo, 1, clean.length),
              'Unterminated else block.',
              'Add a closing brace for else { ... }.'
            ));
            break;
          }
          consumedEnd = elseBlock.endIndex;
        } else {
          const maybeElseIndex = thenBlock.endIndex + 1;
          if (maybeElseIndex < lines.length && isElseOpenLine(stripLineComment(lines[maybeElseIndex]).trim())) {
            hasElse = true;
            elseBlock = collectBlockFromSource(lines, maybeElseIndex);
            if (elseBlock.endIndex === null) {
              diagnostics.push(makeDiagnostic(
                ErrorCodes.Parse.InvalidSyntax,
                'error',
                spanAt(maybeElseIndex + 1, 1, clean.length),
                'Unterminated else block.',
                'Add a closing brace for else { ... }.'
              ));
              break;
            }
            consumedEnd = elseBlock.endIndex;
          }
        }

        const falseTarget = hasElse ? elseLabel : endLabel;
        kernel.cycles.push(makeControlCycle(
          cycleIndex++,
          lineNo,
          ifHeader.row,
          ifHeader.col,
          buildFalseBranchInstruction(ifHeader.condition, falseTarget)
        ));

        {
          const cycleCounter = { value: cycleIndex };
          expandFunctionBodyIntoKernel(
            thenBlock.body,
            kernel,
            functions,
            kernelConstants,
            diagnostics,
            cycleCounter,
            [],
            functionExpansionCounter,
            controlFlowCounter
          );
          cycleIndex = cycleCounter.value;
        }

        if (hasElse && elseBlock) {
          kernel.cycles.push(makeControlCycle(
            cycleIndex++,
            lineNo,
            ifHeader.row,
            ifHeader.col,
            `JUMP ${endLabel}, ZERO`
          ));

          kernel.cycles.push(makeControlCycle(
            cycleIndex++,
            lineNo,
            ifHeader.row,
            ifHeader.col,
            'NOP',
            elseLabel
          ));

          const cycleCounter = { value: cycleIndex };
          expandFunctionBodyIntoKernel(
            elseBlock.body,
            kernel,
            functions,
            kernelConstants,
            diagnostics,
            cycleCounter,
            [],
            functionExpansionCounter,
            controlFlowCounter
          );
          cycleIndex = cycleCounter.value;
        }

        kernel.cycles.push(makeControlCycle(
          cycleIndex++,
          lineNo,
          ifHeader.row,
          ifHeader.col,
          'NOP',
          endLabel
        ));

        i = consumedEnd;
        continue;
      }

      const whileHeader = parseControlHeader(clean, 'while', lineNo, kernelConstants, diagnostics);
      if (whileHeader && kernel) {
        const disableFuse = pendingControlPragmas?.noFuse === true;
        if (hasForScopedPragmas(pendingControlPragmas)) {
          diagnostics.push(makeDiagnostic(
            ErrorCodes.Parse.InvalidSyntax,
            'error',
            pendingControlPragmas!.span,
            `Pragma(s) ${describePendingPragmas(pendingControlPragmas)} cannot be applied to while loops.`,
            'Use #pragma no_fuse for while loops, or move unroll/parallel pragmas before for loops.'
          ));
        }
        pendingControlPragmas = null;

        const loopBlock = collectBlockFromSource(lines, i);
        if (loopBlock.endIndex === null) {
          diagnostics.push(makeDiagnostic(
            ErrorCodes.Parse.InvalidSyntax,
            'error',
            spanAt(lineNo, 1, clean.length),
            'Unterminated while block.',
            'Add a closing brace for while { ... }.'
          ));
          break;
        }

        const suffixId = controlFlowCounter.value++;
        const startLabel = `__while_start_${suffixId}`;
        const endLabel = `__while_end_${suffixId}`;
        const loopKernel: KernelAst = {
          name: '__while_body__',
          config: undefined,
          cycles: [],
          directives: [],
          pragmas: [],
          span: spanAt(lineNo, 1, clean.length)
        };
        const loopCounter = { value: 0 };
        expandFunctionBodyIntoKernel(
          loopBlock.body,
          loopKernel,
          functions,
          kernelConstants,
          diagnostics,
          loopCounter,
          [],
          functionExpansionCounter,
          controlFlowCounter
        );

        const fusionPlan = !disableFuse
          ? buildWhileFusionPlan(loopKernel.cycles, whileHeader.row, whileHeader.col)
          : null;
        const branchCondition = fusionPlan
          ? rewriteConditionForWhileFusion(whileHeader.condition, fusionPlan.incomingRegister)
          : whileHeader.condition;

        kernel.cycles.push(makeControlCycle(
          cycleIndex++,
          lineNo,
          whileHeader.row,
          whileHeader.col,
          buildFalseBranchInstruction(branchCondition, endLabel),
          startLabel
        ));

        for (const cycle of loopKernel.cycles) {
          kernel.cycles.push(cloneCycle(cycle, cycleIndex++));
        }

        let fusedBackEdge = false;
        if (fusionPlan) {
          const jumpText = `JUMP ${startLabel}, ZERO`;
          kernel.cycles[kernel.cycles.length - 1].statements.push({
            kind: 'at',
            row: whileHeader.row,
            col: whileHeader.col,
            instruction: parseInstruction(jumpText, lineNo, 1),
            span: spanAt(lineNo, 1, jumpText.length)
          });
          fusedBackEdge = true;
        }

        if (!fusedBackEdge) {
          kernel.cycles.push(makeControlCycle(
            cycleIndex++,
            lineNo,
            whileHeader.row,
            whileHeader.col,
            `JUMP ${startLabel}, ZERO`
          ));
        }

        kernel.cycles.push(makeControlCycle(
          cycleIndex++,
          lineNo,
          whileHeader.row,
          whileHeader.col,
          'NOP',
          endLabel
        ));

        i = loopBlock.endIndex;
        continue;
      }

      diagnostics.push(makeDiagnostic(
        ErrorCodes.Parse.InvalidSyntax,
        'error',
        spanAt(lineNo, 1, clean.length),
        `Unexpected kernel statement: '${clean}'`,
        hasAnyPendingPragmas(pendingControlPragmas)
          ? 'Control pragmas must be followed by a compatible for/while loop.'
          : 'Expected config, directive, pragma, cycle block, if/while block, function call, or kernel close.'
      ));
      pendingControlPragmas = null;
      continue;
    }

    if (inCycle) {
      if (clean === '}') {
        if (kernel && currentCycle) {
          kernel.cycles.push(currentCycle);
        }
        currentCycle = null;
        inCycle = false;
        continue;
      }

      const loopHeader = parseForHeader(clean, lineNo, cycleConstants, new Map(), diagnostics);
      if (loopHeader) {
        if (loopHeader.control) {
          diagnostics.push(makeDiagnostic(
            ErrorCodes.Parse.InvalidSyntax,
            'error',
            spanAt(lineNo, 1, clean.length),
            'Control location @row,col is not supported for for-loops inside cycle blocks.',
            'Move the loop to kernel/function scope to use runtime-control syntax.'
          ));
          continue;
        }

        const block = collectBlockFromSource(lines, i);
        if (block.endIndex === null) {
          diagnostics.push(makeDiagnostic(
            ErrorCodes.Parse.InvalidSyntax,
            'error',
            spanAt(lineNo, 1, clean.length),
            'Unterminated for loop inside cycle block.',
            'Add a closing brace for for { ... }.'
          ));
          break;
        }

        const shouldContinue = loopHeader.step > 0
          ? (v: number) => v < loopHeader.end
          : (v: number) => v > loopHeader.end;

        for (let value = loopHeader.start; shouldContinue(value); value += loopHeader.step) {
          const bindings = new Map<string, number>();
          bindings.set(loopHeader.variable, value);
          const expanded = expandLoopBody(block.body, cycleConstants, bindings, diagnostics);
          currentCycle?.statements.push(...expanded);
        }

        i = block.endIndex;
        continue;
      }

      const statement = parseCycleStatement(clean, lineNo, rawLine, cycleConstants, new Map());
      if (!statement) {
        diagnostics.push(makeDiagnostic(
          ErrorCodes.Parse.InvalidSyntax,
          'error',
          spanAt(lineNo, 1, clean.length),
          `Invalid cycle statement: '${clean}'`,
          'Expected @row,col:, row N:, col N:, all:, or for ... in range(...) { ... }.'
        ));
        continue;
      }

      currentCycle?.statements.push(statement);
    }
  }

  if (inCycle) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      spanAt(lines.length, 1, 1),
      'Unterminated cycle block.',
      'Add a closing brace for cycle { ... }.'
    ));
  }

  if (autoCycleActive) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      spanAt(lines.length, 1, 1),
      '#pragma auto_cycle without matching #pragma end_auto_cycle.',
      'Close the auto-cycle region with #pragma end_auto_cycle.'
    ));
    flushAutoCycleCurrent();
  }

  if (inKernel) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      spanAt(lines.length, 1, 1),
      'Unterminated kernel block.',
      'Add a closing brace for kernel { ... }.'
    ));
  }

  if (!ast.targetProfileId) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.MissingTarget,
      'error',
      spanAt(1, 1, 1),
      'Missing required target declaration.',
      'Add: target "uma-cgra-v1";'
    ));
  }

  if (!ast.kernel) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.MissingKernel,
      'error',
      spanAt(1, 1, 1),
      'Missing kernel declaration.',
      'Add: kernel "Name" { ... }'
    ));
  }

  return {
    success: diagnostics.every((d) => d.severity !== 'error'),
    ast,
    diagnostics
  };
}
