import { getInstructionSet } from '@openedge/lang-spec';
import {
  AstProgram,
  CycleAst,
  CompilerPass,
  Diagnostic,
  ErrorCodes,
  GridSpec,
  HirCycle,
  HirOperation,
  HirProgram,
  InstructionAst,
  LirProgram,
  MirProgram,
  SourceSpan,
  makeDiagnostic
} from '@openedge/compiler-ir';

const BINARY_OPCODES: Record<string, string> = {
  '+': 'SADD',
  '-': 'SSUB',
  '*': 'SMUL',
  '&': 'LAND',
  '|': 'LOR',
  '^': 'LXOR',
  '<<': 'SLT',
  '>>': 'SRT'
};

const VALID_OPCODES = new Set(getInstructionSet().map((x) => x.opcode));
const SUPPORTED_PRAGMAS = new Set<string>(['route']);
const BRANCH_LABEL_OPERAND_INDEX: Readonly<Record<string, number>> = {
  BEQ: 2,
  BNE: 2,
  BLT: 2,
  BGE: 2,
  JUMP: 0
};

interface RoutePoint {
  row: number;
  col: number;
}

interface RouteCustomOp {
  opcode: string;
  dest: string;
  srcA: string;
  srcB: string;
}

interface RoutePragmaArgs {
  src: RoutePoint;
  dst: RoutePoint;
  payload: string;
  accum: string;
  destReg?: string;
  customOp?: RouteCustomOp;
}

function cloneInstruction(instruction: InstructionAst): InstructionAst {
  return {
    ...instruction,
    operands: [...instruction.operands],
    span: { ...instruction.span }
  };
}

function cloneAst(ast: AstProgram): AstProgram {
  if (!ast.kernel) {
    return { ...ast, span: { ...ast.span } };
  }

  return {
    ...ast,
    span: { ...ast.span },
    kernel: {
      ...ast.kernel,
      span: { ...ast.kernel.span },
      config: ast.kernel.config ? { ...ast.kernel.config, span: { ...ast.kernel.config.span } } : undefined,
      directives: ast.kernel.directives.map((d) => ({ ...d, span: { ...d.span } })),
      pragmas: ast.kernel.pragmas.map((p) => ({ ...p, span: { ...p.span } })),
      cycles: ast.kernel.cycles.map((cycle) => ({
        ...cycle,
        label: cycle.label,
        span: { ...cycle.span },
        statements: cycle.statements.map((stmt) => {
          if (stmt.kind === 'at') {
            return {
              ...stmt,
              span: { ...stmt.span },
              instruction: cloneInstruction(stmt.instruction)
            };
          }

          if (stmt.kind === 'row') {
            return {
              ...stmt,
              span: { ...stmt.span },
              instructions: stmt.instructions.map(cloneInstruction)
            };
          }

          return {
            ...stmt,
            span: { ...stmt.span },
            instruction: cloneInstruction(stmt.instruction)
          };
        })
      }))
    }
  };
}

function extractPragmaName(text: string): string {
  const match = text.trim().match(/^#pragma\s+([A-Za-z_][A-Za-z0-9_]*)/i);
  return match ? match[1].toLowerCase() : 'unknown';
}

function isNumericLiteralToken(text: string): boolean {
  const trimmed = text.trim();
  return /^-?\d+$/.test(trimmed) || /^-?0x[0-9a-f]+$/i.test(trimmed);
}

function resolveLabelOperand(
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

function cloneSpan(span: SourceSpan): SourceSpan {
  return { ...span };
}

function skipWhitespace(text: string, index: number): number {
  let pos = index;
  while (pos < text.length && /\s/.test(text[pos])) pos++;
  return pos;
}

function readIdentifier(text: string, index: number): { value: string; next: number } | null {
  const match = text.slice(index).match(/^[A-Za-z_][A-Za-z0-9_]*/);
  if (!match) return null;
  return {
    value: match[0],
    next: index + match[0].length
  };
}

function readInteger(text: string, index: number): { value: number; next: number } | null {
  const match = text.slice(index).match(/^-?\d+/);
  if (!match) return null;
  return {
    value: parseInt(match[0], 10),
    next: index + match[0].length
  };
}

function parseRouteCoordinate(text: string, index: number): { point: RoutePoint; next: number } | null {
  let pos = skipWhitespace(text, index);
  if (pos >= text.length) return null;

  if (text[pos] === '@') {
    pos++;
    pos = skipWhitespace(text, pos);
    const row = readInteger(text, pos);
    if (!row) return null;
    pos = skipWhitespace(text, row.next);
    if (text[pos] !== ',') return null;
    pos++;
    pos = skipWhitespace(text, pos);
    const col = readInteger(text, pos);
    if (!col) return null;
    return {
      point: { row: row.value, col: col.value },
      next: col.next
    };
  }

  if (text[pos] === '(') {
    pos++;
    pos = skipWhitespace(text, pos);
    const row = readInteger(text, pos);
    if (!row) return null;
    pos = skipWhitespace(text, row.next);
    if (text[pos] !== ',') return null;
    pos++;
    pos = skipWhitespace(text, pos);
    const col = readInteger(text, pos);
    if (!col) return null;
    pos = skipWhitespace(text, col.next);
    if (text[pos] !== ')') return null;
    return {
      point: { row: row.value, col: col.value },
      next: pos + 1
    };
  }

  return null;
}

function parseNamedRegisterArg(
  text: string,
  index: number,
  expectedName: string
): { value: string; next: number } | null {
  let pos = skipWhitespace(text, index);
  const key = readIdentifier(text, pos);
  if (!key || key.value.toLowerCase() !== expectedName.toLowerCase()) return null;
  pos = skipWhitespace(text, key.next);
  if (text[pos] !== '(') return null;
  pos++;
  pos = skipWhitespace(text, pos);
  const reg = readIdentifier(text, pos);
  if (!reg) return null;
  pos = skipWhitespace(text, reg.next);
  if (text[pos] !== ')') return null;
  return {
    value: reg.value,
    next: pos + 1
  };
}

function parseNamedParenthesizedValue(
  text: string,
  index: number,
  expectedName: string
): { value: string; next: number } | null {
  let pos = skipWhitespace(text, index);
  const key = readIdentifier(text, pos);
  if (!key || key.value.toLowerCase() !== expectedName.toLowerCase()) return null;
  pos = skipWhitespace(text, key.next);
  if (text[pos] !== '(') return null;
  pos++;

  const start = pos;
  let depth = 1;
  while (pos < text.length) {
    const ch = text[pos];
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (depth === 0) {
      return {
        value: text.slice(start, pos).trim(),
        next: pos + 1
      };
    }
    pos++;
  }

  return null;
}

function parseRouteCustomOp(text: string): RouteCustomOp | null {
  const match = text.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)\s+([^,]+)\s*,\s*([^,]+)\s*,\s*(.+)$/);
  if (!match) return null;
  const opcode = match[1].trim().toUpperCase();
  const dest = match[2].trim();
  const srcA = match[3].trim();
  const srcB = match[4].trim();
  if (!dest || !srcA || !srcB) return null;
  return { opcode, dest, srcA, srcB };
}

function parseRoutePragmaArgs(text: string): RoutePragmaArgs | null {
  const match = text.trim().match(/^#pragma\s+route\s+(.+)$/i);
  if (!match) return null;

  const body = match[1].trim();
  let pos = 0;

  const src = parseRouteCoordinate(body, pos);
  if (!src) return null;
  pos = skipWhitespace(body, src.next);

  if (!body.startsWith('->', pos)) return null;
  pos += 2;

  const dst = parseRouteCoordinate(body, pos);
  if (!dst) return null;
  pos = skipWhitespace(body, dst.next);

  const payload = parseNamedRegisterArg(body, pos, 'payload');
  if (!payload) return null;
  pos = skipWhitespace(body, payload.next);

  const maybeAccum = parseNamedRegisterArg(body, pos, 'accum');
  if (maybeAccum) {
    const tail = body.slice(skipWhitespace(body, maybeAccum.next)).trim();
    if (tail.length > 0) return null;
    return {
      src: src.point,
      dst: dst.point,
      payload: payload.value,
      accum: maybeAccum.value
    };
  }

  const destReg = parseNamedRegisterArg(body, pos, 'dest');
  if (!destReg) return null;
  pos = skipWhitespace(body, destReg.next);

  const opExpr = parseNamedParenthesizedValue(body, pos, 'op');
  if (!opExpr) return null;
  const tail = body.slice(skipWhitespace(body, opExpr.next)).trim();
  if (tail.length > 0) return null;

  const customOp = parseRouteCustomOp(opExpr.value);
  if (!customOp) return null;

  return {
    src: src.point,
    dst: dst.point,
    payload: payload.value,
    accum: destReg.value,
    destReg: destReg.value,
    customOp
  };
}

function wrap(value: number, size: number): number {
  return ((value % size) + size) % size;
}

function isSamePoint(a: RoutePoint, b: RoutePoint): boolean {
  return a.row === b.row && a.col === b.col;
}

function computeRoutePath(src: RoutePoint, dst: RoutePoint, grid: GridSpec): RoutePoint[] {
  if (isSamePoint(src, dst)) {
    return [{ ...src }];
  }

  const path: RoutePoint[] = [{ ...src }];
  let current: RoutePoint = { ...src };

  if (grid.topology === 'torus') {
    const rightDist = (dst.col - current.col + grid.cols) % grid.cols;
    const leftDist = (current.col - dst.col + grid.cols) % grid.cols;
    const hStep = rightDist <= leftDist ? 1 : -1;
    const hCount = rightDist <= leftDist ? rightDist : leftDist;

    for (let i = 0; i < hCount; i++) {
      current = { row: current.row, col: wrap(current.col + hStep, grid.cols) };
      path.push(current);
    }

    const downDist = (dst.row - current.row + grid.rows) % grid.rows;
    const upDist = (current.row - dst.row + grid.rows) % grid.rows;
    const vStep = downDist <= upDist ? 1 : -1;
    const vCount = downDist <= upDist ? downDist : upDist;

    for (let i = 0; i < vCount; i++) {
      current = { row: wrap(current.row + vStep, grid.rows), col: current.col };
      path.push(current);
    }
    return path;
  }

  const hStep = dst.col >= current.col ? 1 : -1;
  while (current.col !== dst.col) {
    current = { row: current.row, col: current.col + hStep };
    path.push(current);
  }

  const vStep = dst.row >= current.row ? 1 : -1;
  while (current.row !== dst.row) {
    current = { row: current.row + vStep, col: current.col };
    path.push(current);
  }

  return path;
}

function isStep(
  prev: RoutePoint,
  curr: RoutePoint,
  deltaRow: number,
  deltaCol: number,
  grid: GridSpec
): boolean {
  if (grid.topology === 'torus') {
    return (
      wrap(prev.row + deltaRow, grid.rows) === curr.row &&
      wrap(prev.col + deltaCol, grid.cols) === curr.col
    );
  }

  return prev.row + deltaRow === curr.row && prev.col + deltaCol === curr.col;
}

function getIncomingRegister(prev: RoutePoint, curr: RoutePoint, grid: GridSpec): string | null {
  if (prev.row === curr.row) {
    if (isStep(prev, curr, 0, 1, grid)) return 'RCL';
    if (isStep(prev, curr, 0, -1, grid)) return 'RCR';
  }

  if (prev.col === curr.col) {
    if (isStep(prev, curr, 1, 0, grid)) return 'RCT';
    if (isStep(prev, curr, -1, 0, grid)) return 'RCB';
  }

  return null;
}

function createInstruction(opcode: string, operands: string[], span: SourceSpan): InstructionAst {
  const normalizedOpcode = opcode.toUpperCase();
  return {
    text: operands.length > 0
      ? `${normalizedOpcode} ${operands.join(', ')}`
      : normalizedOpcode,
    opcode: normalizedOpcode,
    operands: [...operands],
    span: cloneSpan(span)
  };
}

function createAtCycle(
  index: number,
  row: number,
  col: number,
  instruction: InstructionAst,
  span: SourceSpan,
  label?: string
): CycleAst {
  return {
    index,
    label,
    statements: [{
      kind: 'at',
      row,
      col,
      instruction,
      span: cloneSpan(span)
    }],
    span: cloneSpan(span)
  };
}

function replaceIncoming(token: string, incoming: string): string {
  return token.trim().toUpperCase() === 'INCOMING' ? incoming : token.trim();
}

function buildRouteCycles(
  route: RoutePragmaArgs,
  startIndex: number,
  grid: GridSpec,
  span: SourceSpan,
  diagnostics: Diagnostic[]
): CycleAst[] {
  const path = computeRoutePath(route.src, route.dst, grid);
  const cycles: CycleAst[] = [];

  if (path.length === 1) {
    cycles.push(createAtCycle(
      startIndex,
      route.src.row,
      route.src.col,
      createInstruction('SADD', [route.accum, route.accum, route.payload], span),
      span
    ));
    return cycles;
  }

  for (let i = 0; i < path.length; i++) {
    const point = path[i];
    const isFirst = i === 0;
    const isLast = i === path.length - 1;

    if (isFirst) {
      cycles.push(createAtCycle(
        startIndex + i,
        point.row,
        point.col,
        createInstruction('SADD', ['ROUT', route.payload, 'ZERO'], span),
        span
      ));
      continue;
    }

    const incoming = getIncomingRegister(path[i - 1], point, grid);
    if (!incoming) {
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Internal.UnexpectedState,
        'error',
        span,
        `Could not resolve route direction for step (${path[i - 1].row},${path[i - 1].col}) -> (${point.row},${point.col}).`
      ));
      continue;
    }

    if (!isLast) {
      cycles.push(createAtCycle(
        startIndex + i,
        point.row,
        point.col,
        createInstruction('SADD', ['ROUT', incoming, 'ZERO'], span),
        span
      ));
      continue;
    }

    if (route.customOp) {
      const srcA = replaceIncoming(route.customOp.srcA, incoming);
      const srcB = replaceIncoming(route.customOp.srcB, incoming);
      cycles.push(createAtCycle(
        startIndex + i,
        point.row,
        point.col,
        createInstruction(route.customOp.opcode, [route.customOp.dest, srcA, srcB], span),
        span
      ));
      continue;
    }

    cycles.push(createAtCycle(
      startIndex + i,
      point.row,
      point.col,
      createInstruction('SADD', [route.accum, route.accum, incoming], span),
      span
    ));
  }

  return cycles;
}

function isPointInGrid(point: RoutePoint, grid: GridSpec): boolean {
  return (
    point.row >= 0 &&
    point.row < grid.rows &&
    point.col >= 0 &&
    point.col < grid.cols
  );
}

function isIdentifier(token: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(token.trim());
}

function isRawAddress(expr: string): boolean {
  return /^\[(.+)\]$/s.test(expr.trim());
}

function isArrayAddress(expr: string): boolean {
  const compact = expr.replace(/\s+/g, '');
  return /^[A-Za-z_][A-Za-z0-9_]*(\[[^\]]+\])+$/.test(compact);
}

function isMemoryReference(expr: string): boolean {
  return isRawAddress(expr) || isArrayAddress(expr);
}

function parseIntegerLiteral(text: string): number | null {
  const trimmed = text.trim();
  if (/^-?0x[0-9a-f]+$/i.test(trimmed)) {
    const sign = trimmed.startsWith('-') ? -1 : 1;
    const raw = trimmed.startsWith('-') ? trimmed.slice(1) : trimmed;
    return sign * parseInt(raw, 16);
  }
  if (/^-?\d+$/.test(trimmed)) {
    return parseInt(trimmed, 10);
  }
  return null;
}

function toAddressOperand(
  memExpr: string,
  dataSymbols: ReadonlyMap<string, number>,
  passDiagnostics: Diagnostic[],
  span: SourceSpan
): string | null {
  const trimmed = memExpr.trim();
  const raw = trimmed.match(/^\[(.+)\]$/s);
  if (raw) {
    return raw[1].trim();
  }

  const compact = trimmed.replace(/\s+/g, '');
  const arrayMatch = compact.match(/^([A-Za-z_][A-Za-z0-9_]*)((?:\[[^\]]+\])+)$/
  );
  if (!arrayMatch) {
    return trimmed;
  }

  const arrayName = arrayMatch[1];
  const indices = [...arrayMatch[2].matchAll(/\[([^\]]+)\]/g)].map((m) => m[1].trim());
  if (indices.length !== 1) {
    passDiagnostics.push(makeDiagnostic(
      ErrorCodes.Semantic.UnsupportedOperation,
      'error',
      span,
      `Only 1D .data addressing is supported in v2 baseline, got '${trimmed}'.`,
      'Use single-index accesses like A[i] or raw [addr] expressions.'
    ));
    return null;
  }

  const baseAddress = dataSymbols.get(arrayName);
  if (baseAddress === undefined) {
    passDiagnostics.push(makeDiagnostic(
      ErrorCodes.Semantic.InvalidAssignment,
      'error',
      span,
      `Undefined .data symbol '${arrayName}'.`,
      `Declare it first: .data ${arrayName} { ... }`
    ));
    return null;
  }

  const literalIndex = parseIntegerLiteral(indices[0]);
  if (literalIndex === null) {
    passDiagnostics.push(makeDiagnostic(
      ErrorCodes.Semantic.UnsupportedOperation,
      'error',
      span,
      `v2 baseline only supports literal .data indices, got '${arrayName}[${indices[0]}]'.`,
      `Use a literal index (e.g. ${arrayName}[0]) or compile with legacy backend.`
    ));
    return null;
  }

  return String(baseAddress + literalIndex * 4);
}

function splitAssignment(text: string): { lhs: string; rhs: string } | null {
  let paren = 0;
  let bracket = 0;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') paren++;
    if (ch === ')') paren = Math.max(0, paren - 1);
    if (ch === '[') bracket++;
    if (ch === ']') bracket = Math.max(0, bracket - 1);

    if (ch !== '=' || paren !== 0 || bracket !== 0) continue;

    const prev = text[i - 1] ?? '';
    const next = text[i + 1] ?? '';
    const isComparison = prev === '=' || prev === '!' || prev === '<' || prev === '>' || next === '=';
    if (isComparison) continue;

    return {
      lhs: text.slice(0, i).trim(),
      rhs: text.slice(i + 1).trim()
    };
  }

  return null;
}

function splitTopLevelBinary(rhs: string): { left: string; op: string; right: string } | null {
  let paren = 0;
  let bracket = 0;

  for (let i = 0; i < rhs.length; i++) {
    const ch = rhs[i];
    if (ch === '(') paren++;
    if (ch === ')') paren = Math.max(0, paren - 1);
    if (ch === '[') bracket++;
    if (ch === ']') bracket = Math.max(0, bracket - 1);

    if (paren !== 0 || bracket !== 0) continue;

    const two = rhs.slice(i, i + 2);
    if (two === '<<' || two === '>>') {
      return {
        left: rhs.slice(0, i).trim(),
        op: two,
        right: rhs.slice(i + 2).trim()
      };
    }

    if (['+', '-', '*', '&', '|', '^'].includes(ch)) {
      if (i === 0 && ch === '-') continue;
      return {
        left: rhs.slice(0, i).trim(),
        op: ch,
        right: rhs.slice(i + 1).trim()
      };
    }
  }

  return null;
}

function transformInstructions(
  ast: AstProgram,
  transformer: (instruction: InstructionAst, diagnostics: Diagnostic[]) => InstructionAst
): { output: AstProgram; diagnostics: Diagnostic[] } {
  const out = cloneAst(ast);
  if (!out.kernel) return { output: out, diagnostics: [] };

  const diagnostics: Diagnostic[] = [];

  for (const cycle of out.kernel.cycles) {
    for (const stmt of cycle.statements) {
      if (stmt.kind === 'row') {
        stmt.instructions = stmt.instructions.map((inst) => transformer(inst, diagnostics));
        continue;
      }

      stmt.instruction = transformer(stmt.instruction, diagnostics);
    }
  }

  return { output: out, diagnostics };
}

export function createDesugarMemoryPass(
  dataSymbols: ReadonlyMap<string, number> = new Map()
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
            'Memory-to-memory assignment is not supported in v2.',
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
          'Supported operators: + - * & | ^ << >>'
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

export const desugarAutoCyclePass: CompilerPass<AstProgram, AstProgram> = {
  name: 'desugar-auto-cycle',
  run(input) {
    return { output: cloneAst(input), diagnostics: [] };
  }
};

export function createExpandPragmasPass(strictUnsupported: boolean, grid: GridSpec): CompilerPass<AstProgram, AstProgram> {
  return {
    name: 'expand-pragmas',
    run(input) {
      const output = cloneAst(input);
      const diagnostics: Diagnostic[] = [];

      if (!output.kernel) {
        return { output, diagnostics };
      }

      const generatedCycles: CycleAst[] = [];

      for (const pragma of output.kernel.pragmas) {
        const name = extractPragmaName(pragma.text);
        if (name === 'route') {
          const parsed = parseRoutePragmaArgs(pragma.text);
          if (!parsed) {
            diagnostics.push(makeDiagnostic(
              ErrorCodes.Parse.InvalidSyntax,
              'error',
              pragma.span,
              `Invalid route pragma syntax: '${pragma.text}'.`,
              'Use #pragma route @r1,c1 -> @r2,c2 payload(Rx) accum(Ry) or dest(Rz) op(OP Rd, Ra, Rb).'
            ));
            continue;
          }

          if (!isPointInGrid(parsed.src, grid) || !isPointInGrid(parsed.dst, grid)) {
            diagnostics.push(makeDiagnostic(
              ErrorCodes.Semantic.CoordinateOutOfBounds,
              'error',
              pragma.span,
              `Route pragma coordinates @${parsed.src.row},${parsed.src.col} -> @${parsed.dst.row},${parsed.dst.col} are outside ${grid.rows}x${grid.cols}.`,
              'Adjust coordinates or change CompileOptions.grid.'
            ));
            continue;
          }

          const cycles = buildRouteCycles(
            parsed,
            generatedCycles.length,
            grid,
            pragma.span,
            diagnostics
          );
          generatedCycles.push(...cycles);
          continue;
        }

        if (SUPPORTED_PRAGMAS.has(name)) continue;
        if (!strictUnsupported) continue;

        diagnostics.push(makeDiagnostic(
          ErrorCodes.Semantic.UnsupportedPragma,
          'error',
          pragma.span,
          `Unsupported pragma '${name}' in v2 baseline.`,
          'Use CompileOptions.strictUnsupported=false to allow transitional compilation.'
        ));
      }

      if (generatedCycles.length > 0) {
        const merged = [...generatedCycles, ...output.kernel.cycles];
        output.kernel.cycles = merged.map((cycle, index) => ({
          ...cycle,
          index
        }));
      }

      return { output, diagnostics };
    }
  };
}

export const expandPragmasPass = createExpandPragmasPass(false, {
  rows: 4,
  cols: 4,
  topology: 'torus',
  wrapPolicy: 'wrap'
});

function addOperation(
  operations: HirOperation[],
  occupied: Set<string>,
  cycleIndex: number,
  row: number,
  col: number,
  instruction: InstructionAst,
  grid: GridSpec,
  labels: ReadonlyMap<string, number>,
  diagnostics: Diagnostic[]
): void {
  if (row < 0 || row >= grid.rows || col < 0 || col >= grid.cols) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Semantic.CoordinateOutOfBounds,
      'error',
      instruction.span,
      `Coordinate @${row},${col} is out of bounds for ${grid.rows}x${grid.cols}.`,
      'Adjust the coordinate or change grid size in CompileOptions.'
    ));
    return;
  }

  const key = `${cycleIndex}:${row}:${col}`;
  if (occupied.has(key)) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Semantic.Collision,
      'error',
      instruction.span,
      `Multiple instructions target @${row},${col} in cycle ${cycleIndex}.`,
      'Split these writes into different cycles or coordinates.'
    ));
    return;
  }

  if (!instruction.opcode) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Semantic.InvalidAssignment,
      'error',
      instruction.span,
      `Could not lower instruction '${instruction.text}'.`,
      'Only ISA instructions or supported assignment sugars can be compiled.'
    ));
    return;
  }

  const opcode = instruction.opcode.toUpperCase();
  if (!VALID_OPCODES.has(opcode)) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Semantic.UnknownOpcode,
      'error',
      instruction.span,
      `Unknown opcode '${instruction.opcode}'.`,
      'Check the instruction set catalog in @openedge/lang-spec.'
    ));
    return;
  }

  occupied.add(key);
  const resolvedOperands = resolveLabelOperand(opcode, instruction.operands, labels, instruction.span, diagnostics);
  operations.push({
    row,
    col,
    opcode,
    operands: resolvedOperands,
    span: { ...instruction.span }
  });
}

export function createResolveSymbolsPass(targetProfileId: string, grid: GridSpec): CompilerPass<AstProgram, HirProgram> {
  return {
    name: 'resolve-symbols',
    run(input) {
      const diagnostics: Diagnostic[] = [];

      const kernel = input.kernel;
      const cycles: HirCycle[] = [];
      if (!kernel) {
        return {
          output: {
            targetProfileId,
            grid,
            cycles: []
          },
          diagnostics
        };
      }

      const labels = new Map<string, number>();
      for (const cycle of kernel.cycles) {
        if (!cycle.label) continue;
        if (labels.has(cycle.label)) {
          diagnostics.push(makeDiagnostic(
            ErrorCodes.Semantic.DuplicateLabel,
            'error',
            cycle.span,
            `Duplicate cycle label '${cycle.label}'.`,
            'Use unique labels for each labeled cycle.'
          ));
          continue;
        }
        labels.set(cycle.label, cycle.index);
      }

      for (const cycle of kernel.cycles) {
        const operations: HirOperation[] = [];
        const occupied = new Set<string>();

        for (const stmt of cycle.statements) {
          if (stmt.kind === 'at') {
            addOperation(operations, occupied, cycle.index, stmt.row, stmt.col, stmt.instruction, grid, labels, diagnostics);
            continue;
          }

          if (stmt.kind === 'row') {
            if (stmt.row < 0 || stmt.row >= grid.rows) {
              diagnostics.push(makeDiagnostic(
                ErrorCodes.Semantic.CoordinateOutOfBounds,
                'error',
                stmt.span,
                `Row ${stmt.row} is out of bounds for ${grid.rows}x${grid.cols}.`,
                'Adjust row value or change grid size in CompileOptions.'
              ));
              continue;
            }

            if (stmt.instructions.length === 0) continue;

            if (stmt.instructions.length === 1) {
              for (let col = 0; col < grid.cols; col++) {
                addOperation(operations, occupied, cycle.index, stmt.row, col, stmt.instructions[0], grid, labels, diagnostics);
              }
              continue;
            }

            if (stmt.instructions.length > grid.cols) {
              diagnostics.push(makeDiagnostic(
                ErrorCodes.Semantic.CoordinateOutOfBounds,
                'error',
                stmt.span,
                `Row ${stmt.row} defines ${stmt.instructions.length} columns, grid has ${grid.cols}.`,
                'Reduce row segments or increase grid columns.'
              ));
            }

            const max = Math.min(stmt.instructions.length, grid.cols);
            for (let col = 0; col < max; col++) {
              addOperation(operations, occupied, cycle.index, stmt.row, col, stmt.instructions[col], grid, labels, diagnostics);
            }

            for (let col = max; col < grid.cols; col++) {
              addOperation(operations, occupied, cycle.index, stmt.row, col, {
                text: 'NOP',
                opcode: 'NOP',
                operands: [],
                span: { ...stmt.span }
              }, grid, labels, diagnostics);
            }
            continue;
          }

          if (stmt.kind === 'col') {
            if (stmt.col < 0 || stmt.col >= grid.cols) {
              diagnostics.push(makeDiagnostic(
                ErrorCodes.Semantic.CoordinateOutOfBounds,
                'error',
                stmt.span,
                `Column ${stmt.col} is out of bounds for ${grid.rows}x${grid.cols}.`,
                'Adjust column value or change grid size in CompileOptions.'
              ));
              continue;
            }

            for (let row = 0; row < grid.rows; row++) {
              addOperation(operations, occupied, cycle.index, row, stmt.col, stmt.instruction, grid, labels, diagnostics);
            }
            continue;
          }

          for (let row = 0; row < grid.rows; row++) {
            for (let col = 0; col < grid.cols; col++) {
              addOperation(operations, occupied, cycle.index, row, col, stmt.instruction, grid, labels, diagnostics);
            }
          }
        }

        cycles.push({
          index: cycle.index,
          operations,
          span: { ...cycle.span }
        });
      }

      return {
        output: {
          targetProfileId,
          grid,
          cycles
        },
        diagnostics
      };
    }
  };
}

export function createValidateGridPass(grid: GridSpec): CompilerPass<HirProgram, HirProgram> {
  return {
    name: 'validate-grid',
    run(input) {
      const diagnostics: Diagnostic[] = [];

      for (const cycle of input.cycles) {
        const seen = new Set<string>();
        for (const op of cycle.operations) {
          if (op.row < 0 || op.row >= grid.rows || op.col < 0 || op.col >= grid.cols) {
            diagnostics.push(makeDiagnostic(
              ErrorCodes.Semantic.CoordinateOutOfBounds,
              'error',
              op.span,
              `Operation at @${op.row},${op.col} is out of bounds for ${grid.rows}x${grid.cols}.`
            ));
          }

          const key = `${cycle.index}:${op.row}:${op.col}`;
          if (seen.has(key)) {
            diagnostics.push(makeDiagnostic(
              ErrorCodes.Semantic.Collision,
              'error',
              op.span,
              `Duplicate operation at @${op.row},${op.col} in cycle ${cycle.index}.`
            ));
          }
          seen.add(key);
        }
      }

      return { output: input, diagnostics };
    }
  };
}

export const lowerToMirPass: CompilerPass<HirProgram, MirProgram> = {
  name: 'lower-to-mir',
  run(input) {
    const diagnostics: Diagnostic[] = [];

    const output: MirProgram = {
      targetProfileId: input.targetProfileId,
      grid: input.grid,
      cycles: input.cycles.map((cycle) => ({
        index: cycle.index,
        slots: [...cycle.operations]
          .sort((a, b) => (a.row - b.row) || (a.col - b.col))
          .map((op) => ({
            row: op.row,
            col: op.col,
            instruction: {
              opcode: op.opcode,
              operands: [...op.operands],
              span: { ...op.span }
            }
          }))
      }))
    };

    return { output, diagnostics };
  }
};

export const lowerToLirPass: CompilerPass<MirProgram, LirProgram> = {
  name: 'lower-to-lir',
  run(input) {
    const diagnostics: Diagnostic[] = [];

    return {
      output: {
        targetProfileId: input.targetProfileId,
        grid: { ...input.grid },
        cycles: input.cycles.map((cycle) => ({
          index: cycle.index,
          slots: cycle.slots.map((slot) => ({
            row: slot.row,
            col: slot.col,
            instruction: {
              opcode: slot.instruction.opcode,
              operands: [...slot.instruction.operands],
              span: { ...slot.instruction.span }
            }
          }))
        }))
      },
      diagnostics
    };
  }
};
