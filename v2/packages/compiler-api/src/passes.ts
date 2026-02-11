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
const SUPPORTED_PRAGMAS = new Set<string>([
  'unroll',
  'no_unroll',
  'parallel',
  'no_fuse',
  'route',
  'broadcast',
  'rotate',
  'shift',
  'scan',
  'reduce',
  'stencil',
  'allreduce',
  'transpose',
  'gather',
  'stream_load',
  'stream_store'
]);
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

interface BroadcastPragmaArgs {
  valueReg: string;
  from: RoutePoint;
  scope: 'row' | 'column' | 'all';
}

interface RotateShiftPragmaArgs {
  reg: string;
  direction: 'left' | 'right';
  distance: number;
  fill?: number;
}

interface ScanPragmaArgs {
  operation: string;
  srcReg: string;
  dstReg: string;
  direction: 'left' | 'right' | 'up' | 'down';
  mode: 'inclusive' | 'exclusive';
}

interface ReducePragmaArgs {
  operation: string;
  destReg: string;
  srcReg: string;
  axis: 'row' | 'col';
}

interface StencilPragmaArgs {
  pattern: 'cross' | 'horizontal' | 'vertical';
  operation: string;
  srcReg: string;
  destReg: string;
}

interface AllreducePragmaArgs {
  operation: string;
  destReg: string;
  srcReg: string;
  axis: 'row' | 'col';
}

interface TransposePragmaArgs {
  reg: string;
}

interface GatherPragmaArgs {
  srcReg: string;
  dest: RoutePoint;
  destReg: string;
  operation: string;
}

interface StreamLoadPragmaArgs {
  destReg: string;
  row: number;
  count: number;
}

interface StreamStorePragmaArgs {
  srcReg: string;
  row: number;
  count: number;
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

function parseCoordinateLiteral(text: string): RoutePoint | null {
  const parsed = parseRouteCoordinate(text.trim(), 0);
  if (!parsed) return null;
  const tail = text.slice(parsed.next).trim();
  if (tail.length > 0) return null;
  return parsed.point;
}

function parseBroadcastPragmaArgs(text: string): BroadcastPragmaArgs | null {
  const match = text.trim().match(
    /^#pragma\s+broadcast\s*\(\s*value\s*=\s*([A-Za-z_][A-Za-z0-9_]*)\s*,\s*from\s*=\s*([^,]+(?:,[^,]+)?)\s*,\s*to\s*=\s*(row|column|all)\s*\)\s*$/i
  );
  if (!match) return null;

  const from = parseCoordinateLiteral(match[2]);
  if (!from) return null;

  return {
    valueReg: match[1].trim(),
    from,
    scope: match[3].toLowerCase() as 'row' | 'column' | 'all'
  };
}

function parseKeyValueArgs(body: string): Map<string, string> | null {
  const args = new Map<string, string>();
  const entries = body.split(',').map((part) => part.trim()).filter(Boolean);
  for (const entry of entries) {
    const match = entry.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/);
    if (!match) return null;
    args.set(match[1].toLowerCase(), match[2].trim());
  }
  return args;
}

function parseRotateShiftPragmaArgs(text: string, pragmaName: 'rotate' | 'shift'): RotateShiftPragmaArgs | null {
  const match = text.trim().match(new RegExp(`^#pragma\\s+${pragmaName}\\s*\\((.+)\\)\\s*$`, 'i'));
  if (!match) return null;

  const args = parseKeyValueArgs(match[1]);
  if (!args) return null;

  const reg = args.get('reg');
  const direction = args.get('direction')?.toLowerCase();
  if (!reg || (direction !== 'left' && direction !== 'right')) {
    return null;
  }

  const rawDistance = args.get('distance');
  const distance = rawDistance ? parseIntegerLiteral(rawDistance) : 1;
  if (distance === null || distance <= 0) return null;

  const fillRaw = args.get('fill');
  const fill = fillRaw !== undefined ? parseIntegerLiteral(fillRaw) : undefined;
  if (pragmaName === 'shift' && fillRaw !== undefined && fill === null) {
    return null;
  }

  return {
    reg,
    direction,
    distance,
    fill: fill === undefined ? undefined : fill
  };
}

function parseScanPragmaArgs(text: string): ScanPragmaArgs | null {
  const match = text.trim().match(/^#pragma\s+scan\s*\((.+)\)\s*$/i);
  if (!match) return null;

  const parts = match[1].split(',').map((part) => part.trim()).filter(Boolean);
  if (parts.length < 4 || parts.length > 5) {
    return null;
  }

  const operation = parts[0].toLowerCase();
  const srcReg = parts[1];
  const dstReg = parts[2];
  const direction = parts[3].toLowerCase();
  const mode = (parts[4] ?? 'inclusive').toLowerCase();

  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(srcReg) || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(dstReg)) {
    return null;
  }

  if (!['left', 'right', 'up', 'down'].includes(direction)) {
    return null;
  }

  if (mode !== 'inclusive' && mode !== 'exclusive') {
    return null;
  }

  return {
    operation,
    srcReg,
    dstReg,
    direction: direction as 'left' | 'right' | 'up' | 'down',
    mode: mode as 'inclusive' | 'exclusive'
  };
}

function parseReducePragmaArgs(text: string): ReducePragmaArgs | null {
  const match = text.trim().match(
    /^#pragma\s+reduce\s*\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*,\s*([A-Za-z_][A-Za-z0-9_]*)\s*,\s*([A-Za-z_][A-Za-z0-9_]*)(?:\s*,\s*axis\s*=\s*(row|col))?\s*\)\s*$/i
  );
  if (!match) return null;

  return {
    operation: match[1].toLowerCase(),
    destReg: match[2],
    srcReg: match[3],
    axis: (match[4]?.toLowerCase() as 'row' | 'col' | undefined) ?? 'row'
  };
}

function splitPositionalArgs(body: string): string[] | null {
  const parts: string[] = [];
  let start = 0;
  let depth = 0;

  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === '(' || ch === '[' || ch === '{') depth++;
    if (ch === ')' || ch === ']' || ch === '}') depth = Math.max(0, depth - 1);
    if (ch !== ',' || depth !== 0) continue;

    parts.push(body.slice(start, i).trim());
    start = i + 1;
  }

  parts.push(body.slice(start).trim());
  if (parts.some((part) => part.length === 0)) {
    return null;
  }
  return parts;
}

function parseStencilPragmaArgs(text: string): StencilPragmaArgs | null {
  const match = text.trim().match(/^#pragma\s+stencil\s*\((.+)\)\s*$/i);
  if (!match) return null;

  const parts = splitPositionalArgs(match[1]);
  if (!parts || (parts.length !== 3 && parts.length !== 4)) {
    return null;
  }

  const pattern = parts[0].toLowerCase();
  const operation = (parts.length === 4 ? parts[1] : 'sum').toLowerCase();
  const srcReg = parts.length === 4 ? parts[2] : parts[1];
  const destReg = parts.length === 4 ? parts[3] : parts[2];

  if (!['cross', 'horizontal', 'vertical'].includes(pattern)) return null;
  if (!isIdentifier(operation) || !isIdentifier(srcReg) || !isIdentifier(destReg)) return null;

  return {
    pattern: pattern as 'cross' | 'horizontal' | 'vertical',
    operation,
    srcReg,
    destReg
  };
}

function parseAllreducePragmaArgs(text: string): AllreducePragmaArgs | null {
  const match = text.trim().match(
    /^#pragma\s+allreduce\s*\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*,\s*([A-Za-z_][A-Za-z0-9_]*)\s*,\s*([A-Za-z_][A-Za-z0-9_]*)(?:\s*,\s*axis\s*=\s*(row|col))?\s*\)\s*$/i
  );
  if (!match) return null;

  return {
    operation: match[1].toLowerCase(),
    destReg: match[2],
    srcReg: match[3],
    axis: (match[4]?.toLowerCase() as 'row' | 'col' | undefined) ?? 'row'
  };
}

function parseTransposePragmaArgs(text: string): TransposePragmaArgs | null {
  const match = text.trim().match(/^#pragma\s+transpose\s*\((.+)\)\s*$/i);
  if (!match) return null;

  const args = parseKeyValueArgs(match[1]);
  if (!args) return null;
  const reg = args.get('reg');
  if (!reg || !isIdentifier(reg)) return null;
  if (args.size !== 1) return null;
  return { reg };
}

function parseGatherPragmaArgs(text: string): GatherPragmaArgs | null {
  const match = text.trim().match(
    /^#pragma\s+gather\s*\(\s*src\s*=\s*([A-Za-z_][A-Za-z0-9_]*)\s*,\s*dest\s*=\s*(.+?)\s*,\s*destReg\s*=\s*([A-Za-z_][A-Za-z0-9_]*)\s*,\s*op\s*=\s*([A-Za-z_][A-Za-z0-9_]*)\s*\)\s*$/i
  );
  if (!match) return null;

  const dest = parseCoordinateLiteral(match[2]);
  if (!dest) return null;

  return {
    srcReg: match[1],
    dest,
    destReg: match[3],
    operation: match[4].toLowerCase()
  };
}

function parseStreamLoadPragmaArgs(text: string): StreamLoadPragmaArgs | null {
  const match = text.trim().match(/^#pragma\s+stream_load\s*\((.+)\)\s*$/i);
  if (!match) return null;

  const args = parseKeyValueArgs(match[1]);
  if (!args) return null;

  for (const key of args.keys()) {
    if (key !== 'dest' && key !== 'row' && key !== 'count') {
      return null;
    }
  }

  const destReg = args.get('dest');
  if (!destReg || !isIdentifier(destReg)) return null;

  const rowRaw = args.get('row');
  const row = rowRaw === undefined ? 0 : parseIntegerLiteral(rowRaw);
  if (row === null) return null;

  const countRaw = args.get('count');
  const count = countRaw === undefined ? 1 : parseIntegerLiteral(countRaw);
  if (count === null) return null;

  return {
    destReg,
    row,
    count
  };
}

function parseStreamStorePragmaArgs(text: string): StreamStorePragmaArgs | null {
  const match = text.trim().match(/^#pragma\s+stream_store\s*\((.+)\)\s*$/i);
  if (!match) return null;

  const args = parseKeyValueArgs(match[1]);
  if (!args) return null;

  for (const key of args.keys()) {
    if (key !== 'src' && key !== 'row' && key !== 'count') {
      return null;
    }
  }

  const srcReg = args.get('src');
  if (!srcReg || !isIdentifier(srcReg)) return null;

  const rowRaw = args.get('row');
  const row = rowRaw === undefined ? 0 : parseIntegerLiteral(rowRaw);
  if (row === null) return null;

  const countRaw = args.get('count');
  const count = countRaw === undefined ? 1 : parseIntegerLiteral(countRaw);
  if (count === null) return null;

  return {
    srcReg,
    row,
    count
  };
}

function getScanIncomingRegister(direction: 'left' | 'right' | 'up' | 'down'): string {
  switch (direction) {
    case 'right':
      return 'RCL';
    case 'left':
      return 'RCR';
    case 'down':
      return 'RCT';
    case 'up':
      return 'RCB';
  }
}

function getScanIdentity(operation: string): string {
  switch (operation) {
    case 'add':
    case 'or':
    case 'xor':
      return '0';
    case 'and':
      return '4294967295';
    case 'max':
      return '-2147483648';
    case 'min':
      return '2147483647';
    default:
      return '0';
  }
}

function getScanOpcode(operation: string): string | null {
  switch (operation) {
    case 'add':
      return 'SADD';
    case 'and':
      return 'LAND';
    case 'or':
      return 'LOR';
    case 'xor':
      return 'LXOR';
    default:
      return null;
  }
}

function getReduceOpcode(operation: string): string | null {
  switch (operation) {
    case 'sum':
    case 'add':
      return 'SADD';
    case 'and':
      return 'LAND';
    case 'or':
      return 'LOR';
    case 'xor':
      return 'LXOR';
    case 'mul':
      return 'SMUL';
    default:
      return null;
  }
}

function getGatherOpcode(operation: string): string | null {
  switch (operation) {
    case 'sum':
    case 'add':
      return 'SADD';
    case 'and':
      return 'LAND';
    case 'or':
      return 'LOR';
    case 'xor':
      return 'LXOR';
    case 'mul':
      return 'SMUL';
    default:
      return null;
  }
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

function createRowCycle(
  index: number,
  row: number,
  instructions: InstructionAst[],
  span: SourceSpan
): CycleAst {
  return {
    index,
    statements: [{
      kind: 'row',
      row,
      instructions: instructions.map((inst) => ({
        ...inst,
        span: cloneSpan(inst.span),
        operands: [...inst.operands]
      })),
      span: cloneSpan(span)
    }],
    span: cloneSpan(span)
  };
}

function createMultiAtCycle(
  index: number,
  placements: Array<{ row: number; col: number; instruction: InstructionAst }>,
  span: SourceSpan
): CycleAst {
  return {
    index,
    statements: placements.map((placement) => ({
      kind: 'at' as const,
      row: placement.row,
      col: placement.col,
      instruction: {
        ...placement.instruction,
        span: cloneSpan(placement.instruction.span),
        operands: [...placement.instruction.operands]
      },
      span: cloneSpan(span)
    })),
    span: cloneSpan(span)
  };
}

function replaceIncoming(token: string, incoming: string): string {
  return token.trim().toUpperCase() === 'INCOMING' ? incoming : token.trim();
}

function buildRouteTransferCycles(
  src: RoutePoint,
  dst: RoutePoint,
  payloadReg: string,
  destReg: string,
  startIndex: number,
  grid: GridSpec,
  span: SourceSpan,
  diagnostics: Diagnostic[]
): CycleAst[] {
  const path = computeRoutePath(src, dst, grid);
  const cycles: CycleAst[] = [];
  if (path.length === 0) return cycles;

  if (path.length === 1) {
    cycles.push(createAtCycle(
      startIndex,
      src.row,
      src.col,
      createInstruction('SADD', [destReg, payloadReg, 'ZERO'], span),
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
        createInstruction('SADD', ['ROUT', payloadReg, 'ZERO'], span),
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
        `Could not resolve transfer direction for step (${path[i - 1].row},${path[i - 1].col}) -> (${point.row},${point.col}).`
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

    cycles.push(createAtCycle(
      startIndex + i,
      point.row,
      point.col,
      createInstruction('SADD', [destReg, incoming, 'ZERO'], span),
      span
    ));
  }

  return cycles;
}

function buildBroadcastCycles(
  pragma: BroadcastPragmaArgs,
  startIndex: number,
  grid: GridSpec,
  span: SourceSpan,
  diagnostics: Diagnostic[]
): CycleAst[] {
  const targets: RoutePoint[] = [];

  if (pragma.scope === 'row' || pragma.scope === 'all') {
    for (let col = 0; col < grid.cols; col++) {
      if (col === pragma.from.col) continue;
      targets.push({ row: pragma.from.row, col });
    }
  }

  if (pragma.scope === 'column' || pragma.scope === 'all') {
    for (let row = 0; row < grid.rows; row++) {
      if (row === pragma.from.row) continue;
      const point = { row, col: pragma.from.col };
      if (!targets.some((existing) => isSamePoint(existing, point))) {
        targets.push(point);
      }
    }
  }

  if (pragma.scope === 'all') {
    for (let row = 0; row < grid.rows; row++) {
      for (let col = 0; col < grid.cols; col++) {
        const point = { row, col };
        if (isSamePoint(point, pragma.from)) continue;
        if (!targets.some((existing) => isSamePoint(existing, point))) {
          targets.push(point);
        }
      }
    }
  }

  const cycles: CycleAst[] = [];
  for (const target of targets) {
    const transfer = buildRouteTransferCycles(
      pragma.from,
      target,
      pragma.valueReg,
      pragma.valueReg,
      startIndex + cycles.length,
      grid,
      span,
      diagnostics
    );
    cycles.push(...transfer);
  }

  return cycles;
}

function buildRotateShiftCycles(
  pragma: RotateShiftPragmaArgs,
  isShift: boolean,
  startIndex: number,
  grid: GridSpec,
  span: SourceSpan,
  diagnostics: Diagnostic[]
): CycleAst[] {
  if (grid.rows <= 0 || grid.cols <= 0) {
    return [];
  }

  if (!isShift && grid.topology !== 'torus') {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Semantic.UnsupportedOperation,
      'error',
      span,
      `#pragma rotate currently requires torus topology, got '${grid.topology}'.`,
      'Use topology torus or switch to #pragma shift for mesh.'
    ));
    return [];
  }

  const iterations = isShift
    ? pragma.distance
    : (pragma.distance % grid.cols + grid.cols) % grid.cols;
  if (iterations === 0) {
    return [];
  }

  const cycles: CycleAst[] = [];
  const neighborReg = pragma.direction === 'left' ? 'RCR' : 'RCL';
  const edgeCol = pragma.direction === 'left' ? grid.cols - 1 : 0;
  const fillValue = pragma.fill ?? 0;

  for (let step = 0; step < iterations; step++) {
    const sendPlacements: Array<{ row: number; col: number; instruction: InstructionAst }> = [];
    for (let row = 0; row < grid.rows; row++) {
      for (let col = 0; col < grid.cols; col++) {
        sendPlacements.push({
          row,
          col,
          instruction: createInstruction('SADD', ['ROUT', pragma.reg, 'ZERO'], span)
        });
      }
    }
    cycles.push(createMultiAtCycle(startIndex + cycles.length, sendPlacements, span));

    const recvPlacements: Array<{ row: number; col: number; instruction: InstructionAst }> = [];
    for (let row = 0; row < grid.rows; row++) {
      for (let col = 0; col < grid.cols; col++) {
        if (isShift && col === edgeCol) {
          recvPlacements.push({
            row,
            col,
            instruction: createInstruction('SADD', [pragma.reg, 'ZERO', `IMM(${fillValue})`], span)
          });
          continue;
        }

        recvPlacements.push({
          row,
          col,
          instruction: createInstruction('SADD', [pragma.reg, neighborReg, 'ZERO'], span)
        });
      }
    }
    cycles.push(createMultiAtCycle(startIndex + cycles.length, recvPlacements, span));
  }

  return cycles;
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

function buildScanCycles(
  pragma: ScanPragmaArgs,
  startIndex: number,
  grid: GridSpec,
  span: SourceSpan,
  diagnostics: Diagnostic[]
): CycleAst[] {
  const compareOp = pragma.operation === 'max' || pragma.operation === 'min';
  const simpleOpcode = getScanOpcode(pragma.operation);
  if (!compareOp && !simpleOpcode) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Semantic.UnsupportedOperation,
      'error',
      span,
      `Unsupported scan operation '${pragma.operation}'.`,
      'Supported operations: add, and, or, xor, max, min.'
    ));
    return [];
  }

  const horizontal = pragma.direction === 'left' || pragma.direction === 'right';
  const lineCount = horizontal ? grid.rows : grid.cols;
  const laneLength = horizontal ? grid.cols : grid.rows;
  if (laneLength <= 0 || lineCount <= 0) {
    return [];
  }

  const forward = pragma.direction === 'right' || pragma.direction === 'down';
  const incoming = getScanIncomingRegister(pragma.direction);
  const identity = getScanIdentity(pragma.operation);
  const bsfaFirst = pragma.operation === 'max' ? incoming : pragma.dstReg;
  const bsfaSecond = pragma.operation === 'max' ? pragma.dstReg : incoming;

  const cycles: CycleAst[] = [];

  for (let i = 0; i < laneLength; i++) {
    const laneIndex = forward ? i : laneLength - 1 - i;
    const first = i === 0;
    const stagePlacements: Array<{ row: number; col: number; instruction: InstructionAst }> = [];

    for (let line = 0; line < lineCount; line++) {
      const row = horizontal ? line : laneIndex;
      const col = horizontal ? laneIndex : line;

      if (first) {
        if (pragma.mode === 'inclusive') {
          stagePlacements.push({
            row,
            col,
            instruction: createInstruction('SADD', [pragma.dstReg, pragma.srcReg, 'ZERO'], span)
          });
        } else {
          stagePlacements.push({
            row,
            col,
            instruction: createInstruction('SADD', [pragma.dstReg, 'ZERO', `IMM(${identity})`], span)
          });
        }
        continue;
      }

      if (!compareOp && simpleOpcode) {
        stagePlacements.push({
          row,
          col,
          instruction: createInstruction(simpleOpcode, [pragma.dstReg, pragma.dstReg, incoming], span)
        });
        continue;
      }

      stagePlacements.push({
        row,
        col,
        instruction: createInstruction('SSUB', ['R2', pragma.dstReg, incoming], span)
      });
    }

    if (first) {
      cycles.push(createMultiAtCycle(startIndex + cycles.length, stagePlacements, span));
    } else if (!compareOp && simpleOpcode) {
      cycles.push(createMultiAtCycle(startIndex + cycles.length, stagePlacements, span));
    } else {
      cycles.push(createMultiAtCycle(startIndex + cycles.length, stagePlacements, span));

      const selectPlacements: Array<{ row: number; col: number; instruction: InstructionAst }> = [];
      for (let line = 0; line < lineCount; line++) {
        const row = horizontal ? line : laneIndex;
        const col = horizontal ? laneIndex : line;
        selectPlacements.push({
          row,
          col,
          instruction: createInstruction('BSFA', [pragma.dstReg, bsfaFirst, bsfaSecond, 'SELF'], span)
        });
      }
      cycles.push(createMultiAtCycle(startIndex + cycles.length, selectPlacements, span));
    }

    if (i < laneLength - 1) {
      const relaySource = first && pragma.mode === 'exclusive'
        ? pragma.srcReg
        : pragma.dstReg;
      const relayPlacements: Array<{ row: number; col: number; instruction: InstructionAst }> = [];
      for (let line = 0; line < lineCount; line++) {
        const row = horizontal ? line : laneIndex;
        const col = horizontal ? laneIndex : line;
        relayPlacements.push({
          row,
          col,
          instruction: createInstruction('SADD', ['ROUT', relaySource, 'ZERO'], span)
        });
      }
      cycles.push(createMultiAtCycle(startIndex + cycles.length, relayPlacements, span));
    }
  }

  return cycles;
}

function buildReduceCycles(
  pragma: ReducePragmaArgs,
  startIndex: number,
  grid: GridSpec,
  span: SourceSpan,
  diagnostics: Diagnostic[]
): CycleAst[] {
  const compareOp = pragma.operation === 'max' || pragma.operation === 'min';
  const simpleOpcode = getReduceOpcode(pragma.operation);
  if (!compareOp && !simpleOpcode) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Semantic.UnsupportedOperation,
      'error',
      span,
      `Unsupported reduce operation '${pragma.operation}'.`,
      'Supported operations: sum, add, and, or, xor, mul, max, min.'
    ));
    return [];
  }

  const lanes = pragma.axis === 'row' ? grid.cols : grid.rows;
  if (lanes <= 0) {
    return [];
  }

  const scratch = pickScratchRegisters([pragma.srcReg, pragma.destReg]);
  if (!scratch) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Semantic.UnsupportedOperation,
      'error',
      span,
      `Could not allocate scratch registers for reduce destination '${pragma.destReg}'.`,
      'Use a target profile with temporary registers available.'
    ));
    return [];
  }

  const relayReg = scratch[0];
  const cmpReg = scratch[1];
  const anchor: RoutePoint = { row: 0, col: 0 };
  const sources: RoutePoint[] = [];
  for (let i = 1; i < lanes; i++) {
    sources.push(
      pragma.axis === 'row'
        ? { row: 0, col: i }
        : { row: i, col: 0 }
    );
  }
  sources.sort((a, b) => {
    const da = Math.abs(a.row - anchor.row) + Math.abs(a.col - anchor.col);
    const db = Math.abs(b.row - anchor.row) + Math.abs(b.col - anchor.col);
    if (da !== db) return da - db;
    if (a.row !== b.row) return a.row - b.row;
    return a.col - b.col;
  });

  const cycles: CycleAst[] = [];
  cycles.push(createAtCycle(
    startIndex + cycles.length,
    anchor.row,
    anchor.col,
    createInstruction('SADD', [pragma.destReg, pragma.srcReg, 'ZERO'], span),
    span
  ));

  for (const source of sources) {
    const transfer = buildRouteTransferCycles(
      source,
      anchor,
      pragma.srcReg,
      relayReg,
      startIndex + cycles.length,
      grid,
      span,
      diagnostics
    );
    cycles.push(...transfer);

    if (!compareOp && simpleOpcode) {
      cycles.push(createAtCycle(
        startIndex + cycles.length,
        anchor.row,
        anchor.col,
        createInstruction(simpleOpcode, [pragma.destReg, pragma.destReg, relayReg], span),
        span
      ));
      continue;
    }

    cycles.push(createAtCycle(
      startIndex + cycles.length,
      anchor.row,
      anchor.col,
      createInstruction('SSUB', [cmpReg, pragma.destReg, relayReg], span),
      span
    ));

    const first = pragma.operation === 'max' ? relayReg : pragma.destReg;
    const second = pragma.operation === 'max' ? pragma.destReg : relayReg;
    cycles.push(createAtCycle(
      startIndex + cycles.length,
      anchor.row,
      anchor.col,
      createInstruction('BSFA', [pragma.destReg, first, second, 'SELF'], span),
      span
    ));
  }

  return cycles;
}

function buildStencilCycles(
  pragma: StencilPragmaArgs,
  startIndex: number,
  grid: GridSpec,
  span: SourceSpan,
  diagnostics: Diagnostic[]
): CycleAst[] {
  if (grid.cols <= 0) {
    return [];
  }

  if (!['sum', 'add', 'avg'].includes(pragma.operation)) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Semantic.UnsupportedOperation,
      'error',
      span,
      `Unsupported stencil operation '${pragma.operation}'.`,
      'Supported operations: sum, add, avg.'
    ));
    return [];
  }

  const makeUniformRowCycle = (
    cycleIndex: number,
    dest: string,
    srcA: string,
    srcB: string
  ): CycleAst => createMultiAtCycle(
    cycleIndex,
    Array.from({ length: grid.rows * grid.cols }, (_, idx) => {
      const row = Math.floor(idx / grid.cols);
      const col = idx % grid.cols;
      return {
        row,
        col,
        instruction: createInstruction('SADD', [dest, srcA, srcB], span)
      };
    }),
    span
  );

  const cycles: CycleAst[] = [];

  if (pragma.pattern === 'cross') {
    cycles.push(makeUniformRowCycle(startIndex + cycles.length, 'R2', pragma.srcReg, 'RCT'));
    cycles.push(makeUniformRowCycle(startIndex + cycles.length, 'R2', 'R2', 'RCB'));
    cycles.push(makeUniformRowCycle(startIndex + cycles.length, 'R2', 'R2', 'RCL'));
    cycles.push(makeUniformRowCycle(startIndex + cycles.length, pragma.destReg, 'R2', 'RCR'));
    return cycles;
  }

  if (pragma.pattern === 'horizontal') {
    cycles.push(makeUniformRowCycle(startIndex + cycles.length, 'R2', pragma.srcReg, 'RCL'));
    cycles.push(makeUniformRowCycle(startIndex + cycles.length, pragma.destReg, 'R2', 'RCR'));
    return cycles;
  }

  cycles.push(makeUniformRowCycle(startIndex + cycles.length, 'R2', pragma.srcReg, 'RCT'));
  cycles.push(makeUniformRowCycle(startIndex + cycles.length, pragma.destReg, 'R2', 'RCB'));
  return cycles;
}

function buildAllreduceCycles(
  pragma: AllreducePragmaArgs,
  startIndex: number,
  grid: GridSpec,
  span: SourceSpan,
  diagnostics: Diagnostic[]
): CycleAst[] {
  const reduceBefore = diagnostics.length;
  const reduceCycles = buildReduceCycles(
    {
      operation: pragma.operation,
      destReg: pragma.destReg,
      srcReg: pragma.srcReg,
      axis: pragma.axis
    },
    startIndex,
    grid,
    span,
    diagnostics
  );

  if (diagnostics.length > reduceBefore && reduceCycles.length === 0) {
    return [];
  }

  const broadcastCycles = buildBroadcastCycles(
    {
      valueReg: pragma.destReg,
      from: { row: 0, col: 0 },
      scope: pragma.axis === 'col' ? 'column' : 'row'
    },
    startIndex + reduceCycles.length,
    grid,
    span,
    diagnostics
  );

  return [...reduceCycles, ...broadcastCycles];
}

function pickScratchRegisters(excludes: string[]): [string, string] | null {
  const candidates = ['R7', 'R6', 'R5', 'R4', 'R3', 'R2', 'R1', 'R0'];
  const excludeSet = new Set(excludes.map((reg) => reg.toUpperCase()));
  const filtered = candidates.filter((reg) => !excludeSet.has(reg));
  if (filtered.length < 2) return null;
  return [filtered[0], filtered[1]];
}

function buildTransposeCycles(
  pragma: TransposePragmaArgs,
  startIndex: number,
  grid: GridSpec,
  span: SourceSpan,
  diagnostics: Diagnostic[]
): CycleAst[] {
  if (grid.rows !== grid.cols) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Semantic.UnsupportedOperation,
      'error',
      span,
      `#pragma transpose requires a square grid, got ${grid.rows}x${grid.cols}.`,
      'Use a square grid (e.g. 4x4) for transpose lowering.'
    ));
    return [];
  }

  const scratch = pickScratchRegisters([pragma.reg]);
  if (!scratch) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Semantic.UnsupportedOperation,
      'error',
      span,
      `Could not allocate scratch registers for transpose on '${pragma.reg}'.`,
      'Use a target profile with at least two general-purpose registers besides the transposed register.'
    ));
    return [];
  }

  const [tmpA, tmpB] = scratch;
  const cycles: CycleAst[] = [];
  const n = grid.rows;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a: RoutePoint = { row: i, col: j };
      const b: RoutePoint = { row: j, col: i };

      const forwardCycles = buildRouteTransferCycles(
        a,
        b,
        pragma.reg,
        tmpA,
        startIndex + cycles.length,
        grid,
        span,
        diagnostics
      );
      cycles.push(...forwardCycles);

      const backwardCycles = buildRouteTransferCycles(
        b,
        a,
        pragma.reg,
        tmpB,
        startIndex + cycles.length,
        grid,
        span,
        diagnostics
      );
      cycles.push(...backwardCycles);

      cycles.push(createMultiAtCycle(
        startIndex + cycles.length,
        [
          { row: b.row, col: b.col, instruction: createInstruction('SADD', [pragma.reg, tmpA, 'ZERO'], span) },
          { row: a.row, col: a.col, instruction: createInstruction('SADD', [pragma.reg, tmpB, 'ZERO'], span) }
        ],
        span
      ));
    }
  }

  return cycles;
}

function buildGatherCycles(
  pragma: GatherPragmaArgs,
  startIndex: number,
  grid: GridSpec,
  span: SourceSpan,
  diagnostics: Diagnostic[]
): CycleAst[] {
  if (!isPointInGrid(pragma.dest, grid)) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Semantic.CoordinateOutOfBounds,
      'error',
      span,
      `Gather destination @${pragma.dest.row},${pragma.dest.col} is outside ${grid.rows}x${grid.cols}.`,
      'Adjust destination coordinates or change CompileOptions.grid.'
    ));
    return [];
  }

  const opcode = getGatherOpcode(pragma.operation);
  if (!opcode) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Semantic.UnsupportedOperation,
      'error',
      span,
      `Unsupported gather operation '${pragma.operation}'.`,
      'Supported operations: add, sum, and, or, xor, mul.'
    ));
    return [];
  }

  const scratch = pickScratchRegisters([pragma.srcReg, pragma.destReg]);
  if (!scratch) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Semantic.UnsupportedOperation,
      'error',
      span,
      `Could not allocate scratch registers for gather destination '${pragma.destReg}'.`,
      'Use a target profile with at least one temporary register besides src/dest registers.'
    ));
    return [];
  }
  const relayReg = scratch[0];

  const cycles: CycleAst[] = [];

  cycles.push(createAtCycle(
    startIndex + cycles.length,
    pragma.dest.row,
    pragma.dest.col,
    createInstruction('SADD', [pragma.destReg, pragma.srcReg, 'ZERO'], span),
    span
  ));

  const sources: RoutePoint[] = [];
  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      if (row === pragma.dest.row && col === pragma.dest.col) continue;
      sources.push({ row, col });
    }
  }
  sources.sort((a, b) => {
    const da = Math.abs(a.row - pragma.dest.row) + Math.abs(a.col - pragma.dest.col);
    const db = Math.abs(b.row - pragma.dest.row) + Math.abs(b.col - pragma.dest.col);
    if (da !== db) return da - db;
    if (a.row !== b.row) return a.row - b.row;
    return a.col - b.col;
  });

  for (const src of sources) {
    const transfer = buildRouteTransferCycles(
      src,
      pragma.dest,
      pragma.srcReg,
      relayReg,
      startIndex + cycles.length,
      grid,
      span,
      diagnostics
    );
    cycles.push(...transfer);

    cycles.push(createAtCycle(
      startIndex + cycles.length,
      pragma.dest.row,
      pragma.dest.col,
      createInstruction(opcode, [pragma.destReg, pragma.destReg, relayReg], span),
      span
    ));
  }

  return cycles;
}

function buildStreamCycles(
  opcode: 'LWD' | 'SWD',
  reg: string,
  row: number,
  count: number,
  startIndex: number,
  grid: GridSpec,
  span: SourceSpan,
  diagnostics: Diagnostic[]
): CycleAst[] {
  if (!Number.isInteger(row) || row < 0 || row >= grid.rows) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Semantic.CoordinateOutOfBounds,
      'error',
      span,
      `#pragma ${opcode === 'LWD' ? 'stream_load' : 'stream_store'} row=${row} is outside ${grid.rows} rows.`,
      'Use a valid row index within the current grid.'
    ));
    return [];
  }

  if (!Number.isInteger(count) || count <= 0) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Semantic.UnsupportedOperation,
      'error',
      span,
      `#pragma ${opcode === 'LWD' ? 'stream_load' : 'stream_store'} requires count >= 1, got ${count}.`,
      'Use a positive integer count.'
    ));
    return [];
  }

  const cycles: CycleAst[] = [];
  for (let i = 0; i < count; i++) {
    const instructions = Array.from(
      { length: grid.cols },
      () => createInstruction(opcode, [reg], span)
    );
    cycles.push(createRowCycle(startIndex + cycles.length, row, instructions, span));
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

interface DataSymbolInfo {
  start: number;
  length: number;
  rows?: number;
  cols?: number;
}

function toAddressOperand(
  memExpr: string,
  dataSymbols: ReadonlyMap<string, DataSymbolInfo>,
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
  const symbol = dataSymbols.get(arrayName);
  if (!symbol) {
    passDiagnostics.push(makeDiagnostic(
      ErrorCodes.Semantic.InvalidAssignment,
      'error',
      span,
      `Undefined data symbol '${arrayName}'.`,
      `Declare it first: .data ${arrayName} { ... } or .data2d ${arrayName}[rows][cols].`
    ));
    return null;
  }

  const indices = [...arrayMatch[2].matchAll(/\[([^\]]+)\]/g)].map((m) => m[1].trim());
  if (symbol.rows !== undefined && symbol.cols !== undefined) {
    if (indices.length !== 2) {
      passDiagnostics.push(makeDiagnostic(
        ErrorCodes.Semantic.UnsupportedOperation,
        'error',
        span,
        `Expected 2D addressing for '.data2d ${arrayName}', got '${trimmed}'.`,
        `Use two indices like ${arrayName}[row][col].`
      ));
      return null;
    }

    const rowIndex = parseIntegerLiteral(indices[0]);
    const colIndex = parseIntegerLiteral(indices[1]);
    if (rowIndex !== null && colIndex !== null) {
      if (rowIndex < 0 || rowIndex >= symbol.rows || colIndex < 0 || colIndex >= symbol.cols) {
        passDiagnostics.push(makeDiagnostic(
          ErrorCodes.Semantic.CoordinateOutOfBounds,
          'error',
          span,
          `Index out of bounds for '.data2d ${arrayName}[${symbol.rows}][${symbol.cols}]': [${rowIndex}][${colIndex}].`,
          'Use indices within declared bounds.'
        ));
        return null;
      }

      const linearIndex = rowIndex * symbol.cols + colIndex;
      return String(symbol.start + linearIndex * 4);
    }

    const rowExpr = indices[0];
    const colExpr = indices[1];
    return `${symbol.start} + (((${rowExpr}) * ${symbol.cols}) + (${colExpr})) * 4`;
  }

  if (indices.length !== 1) {
    passDiagnostics.push(makeDiagnostic(
      ErrorCodes.Semantic.UnsupportedOperation,
      'error',
      span,
      `Expected 1D addressing for '.data ${arrayName}', got '${trimmed}'.`,
      `Use one index like ${arrayName}[i].`
    ));
    return null;
  }

  const literalIndex = parseIntegerLiteral(indices[0]);
  if (literalIndex !== null) {
    if (literalIndex < 0 || literalIndex >= symbol.length) {
      passDiagnostics.push(makeDiagnostic(
        ErrorCodes.Semantic.CoordinateOutOfBounds,
        'error',
        span,
        `Index out of bounds for '.data ${arrayName}[${symbol.length}]': [${literalIndex}].`,
        'Use indices within declared bounds.'
      ));
      return null;
    }

    return String(symbol.start + literalIndex * 4);
  }

  return `${symbol.start} + (${indices[0]}) * 4`;
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

        if (name === 'broadcast') {
          const parsed = parseBroadcastPragmaArgs(pragma.text);
          if (!parsed) {
            diagnostics.push(makeDiagnostic(
              ErrorCodes.Parse.InvalidSyntax,
              'error',
              pragma.span,
              `Invalid broadcast pragma syntax: '${pragma.text}'.`,
              'Use #pragma broadcast(value=R0, from=@row,col, to=row|column|all).'
            ));
            continue;
          }

          if (!isPointInGrid(parsed.from, grid)) {
            diagnostics.push(makeDiagnostic(
              ErrorCodes.Semantic.CoordinateOutOfBounds,
              'error',
              pragma.span,
              `Broadcast source @${parsed.from.row},${parsed.from.col} is outside ${grid.rows}x${grid.cols}.`,
              'Adjust source coordinates or change CompileOptions.grid.'
            ));
            continue;
          }

          const cycles = buildBroadcastCycles(
            parsed,
            generatedCycles.length,
            grid,
            pragma.span,
            diagnostics
          );
          generatedCycles.push(...cycles);
          continue;
        }

        if (name === 'rotate' || name === 'shift') {
          const parsed = parseRotateShiftPragmaArgs(pragma.text, name);
          if (!parsed) {
            diagnostics.push(makeDiagnostic(
              ErrorCodes.Parse.InvalidSyntax,
              'error',
              pragma.span,
              `Invalid ${name} pragma syntax: '${pragma.text}'.`,
              name === 'rotate'
                ? 'Use #pragma rotate(reg=R0, direction=left|right, distance=1).'
                : 'Use #pragma shift(reg=R0, direction=left|right, distance=1, fill=0).'
            ));
            continue;
          }

          const cycles = buildRotateShiftCycles(
            parsed,
            name === 'shift',
            generatedCycles.length,
            grid,
            pragma.span,
            diagnostics
          );
          generatedCycles.push(...cycles);
          continue;
        }

        if (name === 'scan') {
          const parsed = parseScanPragmaArgs(pragma.text);
          if (!parsed) {
            diagnostics.push(makeDiagnostic(
              ErrorCodes.Parse.InvalidSyntax,
              'error',
              pragma.span,
              `Invalid scan pragma syntax: '${pragma.text}'.`,
              'Use #pragma scan(operation, srcReg, dstReg, direction[, mode]).'
            ));
            continue;
          }

          const cycles = buildScanCycles(
            parsed,
            generatedCycles.length,
            grid,
            pragma.span,
            diagnostics
          );
          generatedCycles.push(...cycles);
          continue;
        }

        if (name === 'reduce') {
          const parsed = parseReducePragmaArgs(pragma.text);
          if (!parsed) {
            diagnostics.push(makeDiagnostic(
              ErrorCodes.Parse.InvalidSyntax,
              'error',
              pragma.span,
              `Invalid reduce pragma syntax: '${pragma.text}'.`,
              'Use #pragma reduce(operation, destReg, srcReg[, axis=row|col]).'
            ));
            continue;
          }

          const cycles = buildReduceCycles(
            parsed,
            generatedCycles.length,
            grid,
            pragma.span,
            diagnostics
          );
          generatedCycles.push(...cycles);
          continue;
        }

        if (name === 'stencil') {
          const parsed = parseStencilPragmaArgs(pragma.text);
          if (!parsed) {
            diagnostics.push(makeDiagnostic(
              ErrorCodes.Parse.InvalidSyntax,
              'error',
              pragma.span,
              `Invalid stencil pragma syntax: '${pragma.text}'.`,
              'Use #pragma stencil(pattern, srcReg, destReg) or #pragma stencil(pattern, operation, srcReg, destReg).'
            ));
            continue;
          }

          const cycles = buildStencilCycles(
            parsed,
            generatedCycles.length,
            grid,
            pragma.span,
            diagnostics
          );
          generatedCycles.push(...cycles);
          continue;
        }

        if (name === 'allreduce') {
          const parsed = parseAllreducePragmaArgs(pragma.text);
          if (!parsed) {
            diagnostics.push(makeDiagnostic(
              ErrorCodes.Parse.InvalidSyntax,
              'error',
              pragma.span,
              `Invalid allreduce pragma syntax: '${pragma.text}'.`,
              'Use #pragma allreduce(operation, destReg, srcReg[, axis=row|col]).'
            ));
            continue;
          }

          const cycles = buildAllreduceCycles(
            parsed,
            generatedCycles.length,
            grid,
            pragma.span,
            diagnostics
          );
          generatedCycles.push(...cycles);
          continue;
        }

        if (name === 'transpose') {
          const parsed = parseTransposePragmaArgs(pragma.text);
          if (!parsed) {
            diagnostics.push(makeDiagnostic(
              ErrorCodes.Parse.InvalidSyntax,
              'error',
              pragma.span,
              `Invalid transpose pragma syntax: '${pragma.text}'.`,
              'Use #pragma transpose(reg=R0).'
            ));
            continue;
          }

          const cycles = buildTransposeCycles(
            parsed,
            generatedCycles.length,
            grid,
            pragma.span,
            diagnostics
          );
          generatedCycles.push(...cycles);
          continue;
        }

        if (name === 'gather') {
          const parsed = parseGatherPragmaArgs(pragma.text);
          if (!parsed) {
            diagnostics.push(makeDiagnostic(
              ErrorCodes.Parse.InvalidSyntax,
              'error',
              pragma.span,
              `Invalid gather pragma syntax: '${pragma.text}'.`,
              'Use #pragma gather(src=R0, dest=@row,col, destReg=R1, op=add).'
            ));
            continue;
          }

          const cycles = buildGatherCycles(
            parsed,
            generatedCycles.length,
            grid,
            pragma.span,
            diagnostics
          );
          generatedCycles.push(...cycles);
          continue;
        }

        if (name === 'stream_load') {
          const parsed = parseStreamLoadPragmaArgs(pragma.text);
          if (!parsed) {
            diagnostics.push(makeDiagnostic(
              ErrorCodes.Parse.InvalidSyntax,
              'error',
              pragma.span,
              `Invalid stream_load pragma syntax: '${pragma.text}'.`,
              'Use #pragma stream_load(dest=R0[, row=N][, count=N]).'
            ));
            continue;
          }

          const cycles = buildStreamCycles(
            'LWD',
            parsed.destReg,
            parsed.row,
            parsed.count,
            generatedCycles.length,
            grid,
            pragma.span,
            diagnostics
          );
          generatedCycles.push(...cycles);
          continue;
        }

        if (name === 'stream_store') {
          const parsed = parseStreamStorePragmaArgs(pragma.text);
          if (!parsed) {
            diagnostics.push(makeDiagnostic(
              ErrorCodes.Parse.InvalidSyntax,
              'error',
              pragma.span,
              `Invalid stream_store pragma syntax: '${pragma.text}'.`,
              'Use #pragma stream_store(src=R0[, row=N][, count=N]).'
            ));
            continue;
          }

          const cycles = buildStreamCycles(
            'SWD',
            parsed.srcReg,
            parsed.row,
            parsed.count,
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
