import {
  CycleAst,
  CycleStatementAst,
  GridSpec,
  InstructionAst
} from '@castm/compiler-ir';

const CONTROL_OPCODES = new Set([
  'BEQ',
  'BNE',
  'BLT',
  'BGE',
  'JUMP',
  'EXIT'
]);

const WRITE_FIRST_OPCODES = new Set([
  'SADD',
  'SSUB',
  'SMUL',
  'FXPMUL',
  'LAND',
  'LNAND',
  'LOR',
  'LNOR',
  'LXOR',
  'LXNOR',
  'SLT',
  'SRT',
  'SRA',
  'BSFA',
  'BZFA'
]);

const IGNORED_IDENTIFIERS = new Set([
  'IMM',
  'INCOMING',
  'SELF',
  'ZERO'
]);

const INCOMING_IDENTIFIERS = new Set([
  'RCL',
  'RCR',
  'RCT',
  'RCB'
]);

interface Placement {
  row: number;
  col: number;
  instruction: InstructionAst;
  span: CycleStatementAst['span'];
}

type IncomingDirection = 'RCL' | 'RCR' | 'RCT' | 'RCB';

interface IncomingRead {
  row: number;
  col: number;
  direction: IncomingDirection;
}

interface AccessSummary {
  reads: Set<string>;
  writes: Set<string>;
  hasMemory: boolean;
  incomingDirections: IncomingDirection[];
  writesRoute: boolean;
}

interface CycleSummary {
  placements: Placement[];
  occupied: Set<string>;
  reads: Set<string>;
  writes: Set<string>;
  hasMemory: boolean;
  incomingReads: IncomingRead[];
  routeWrites: Set<string>;
  writesRoute: boolean;
}

function isNoopInstruction(instruction: InstructionAst): boolean {
  const text = instruction.text.trim().toUpperCase();
  return text === 'NOP' || text === '_';
}

function isIdentifierToken(token: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(token);
}

function extractIdentifierTokens(text: string): string[] {
  const matches = text.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? [];
  return matches
    .map((value) => value.toUpperCase())
    .filter((value) => isIdentifierToken(value) && !IGNORED_IDENTIFIERS.has(value));
}

function collectStatementPlacements(statement: CycleStatementAst, grid: GridSpec): Placement[] | null {
  if (statement.kind === 'at-expr') return null;

  if (statement.kind === 'at') {
    return [{
      row: statement.row,
      col: statement.col,
      instruction: statement.instruction,
      span: statement.span
    }];
  }

  if (statement.kind === 'row') {
    if (statement.row < 0 || statement.row >= grid.rows) return null;
    const placements: Placement[] = [];
    for (let col = 0; col < statement.instructions.length && col < grid.cols; col++) {
      placements.push({
        row: statement.row,
        col,
        instruction: statement.instructions[col],
        span: statement.span
      });
    }
    return placements;
  }

  if (statement.kind === 'col') {
    if (statement.col < 0 || statement.col >= grid.cols) return null;
    const placements: Placement[] = [];
    for (let row = 0; row < grid.rows; row++) {
      placements.push({
        row,
        col: statement.col,
        instruction: statement.instruction,
        span: statement.span
      });
    }
    return placements;
  }

  const placements: Placement[] = [];
  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      placements.push({
        row,
        col,
        instruction: statement.instruction,
        span: statement.span
      });
    }
  }
  return placements;
}

function summarizeInstruction(instruction: InstructionAst): AccessSummary | null {
  const opcode = instruction.opcode?.trim().toUpperCase();
  if (!opcode || CONTROL_OPCODES.has(opcode)) return null;

  const reads = new Set<string>();
  const writes = new Set<string>();
  const operands = instruction.operands.map((operand) => operand.trim());
  const incomingDirections: IncomingDirection[] = [];

  const addReads = (operand: string) => {
    for (const token of extractIdentifierTokens(operand)) {
      reads.add(token);
      if (INCOMING_IDENTIFIERS.has(token)) {
        incomingDirections.push(token as IncomingDirection);
      }
    }
  };

  if (opcode === 'LWD') {
    const dest = operands[0]?.toUpperCase();
    if (!dest || !isIdentifierToken(dest)) return null;
    writes.add(dest);
    return {
      reads,
      writes,
      hasMemory: true,
      incomingDirections,
      writesRoute: false
    };
  }

  if (opcode === 'SWD') {
    const src = operands[0] ?? '';
    addReads(src);
    return {
      reads,
      writes,
      hasMemory: true,
      incomingDirections,
      writesRoute: false
    };
  }

  if (opcode === 'LWI') {
    const dest = operands[0]?.toUpperCase();
    if (!dest || !isIdentifierToken(dest)) return null;
    writes.add(dest);
    addReads(operands[1] ?? '');
    return {
      reads,
      writes,
      hasMemory: true,
      incomingDirections,
      writesRoute: false
    };
  }

  if (opcode === 'SWI') {
    addReads(operands[0] ?? '');
    addReads(operands[1] ?? '');
    return {
      reads,
      writes,
      hasMemory: true,
      incomingDirections,
      writesRoute: false
    };
  }

  if (!WRITE_FIRST_OPCODES.has(opcode)) return null;
  const dest = operands[0]?.toUpperCase();
  if (!dest || !isIdentifierToken(dest)) return null;
  writes.add(dest);

  for (const operand of operands.slice(1)) {
    addReads(operand);
  }

  return {
    reads,
    writes,
    hasMemory: false,
    incomingDirections,
    writesRoute: dest === 'ROUT'
  };
}

function summarizeCycle(cycle: CycleAst, grid: GridSpec): CycleSummary | null {
  const placements: Placement[] = [];
  for (const statement of cycle.statements) {
    const expanded = collectStatementPlacements(statement, grid);
    if (!expanded) return null;
    placements.push(...expanded);
  }

  const occupied = new Set<string>();
  const reads = new Set<string>();
  const writes = new Set<string>();
  let hasMemory = false;
  const incomingReads: IncomingRead[] = [];
  const routeWrites = new Set<string>();
  let writesRoute = false;

  for (const placement of placements) {
    if (isNoopInstruction(placement.instruction)) continue;
    occupied.add(`${placement.row},${placement.col}`);

    const access = summarizeInstruction(placement.instruction);
    if (!access) return null;
    if (access.hasMemory) hasMemory = true;
    if (access.writesRoute) {
      writesRoute = true;
      routeWrites.add(`${placement.row},${placement.col}`);
    }
    for (const direction of access.incomingDirections) {
      incomingReads.push({
        row: placement.row,
        col: placement.col,
        direction
      });
    }
    for (const token of access.reads) reads.add(token);
    for (const token of access.writes) writes.add(token);
  }

  return {
    placements: placements.filter((placement) => !isNoopInstruction(placement.instruction)),
    occupied,
    reads,
    writes,
    hasMemory,
    incomingReads,
    routeWrites,
    writesRoute
  };
}

function wrapIndex(value: number, size: number): number {
  return ((value % size) + size) % size;
}

function incomingSourceCoordinate(
  row: number,
  col: number,
  direction: IncomingDirection,
  grid: GridSpec
): string | null {
  let sourceRow = row;
  let sourceCol = col;
  if (direction === 'RCL') sourceCol -= 1;
  if (direction === 'RCR') sourceCol += 1;
  if (direction === 'RCT') sourceRow -= 1;
  if (direction === 'RCB') sourceRow += 1;

  if (grid.wrapPolicy === 'wrap') {
    sourceRow = wrapIndex(sourceRow, grid.rows);
    sourceCol = wrapIndex(sourceCol, grid.cols);
    return `${sourceRow},${sourceCol}`;
  }

  if (sourceRow < 0 || sourceRow >= grid.rows || sourceCol < 0 || sourceCol >= grid.cols) {
    return null;
  }
  return `${sourceRow},${sourceCol}`;
}

function hasRouteDependency(
  producer: CycleSummary,
  consumer: CycleSummary,
  grid: GridSpec
): boolean {
  if (!producer.writesRoute || consumer.incomingReads.length === 0) return false;
  for (const incoming of consumer.incomingReads) {
    const source = incomingSourceCoordinate(incoming.row, incoming.col, incoming.direction, grid);
    if (!source) continue;
    if (producer.routeWrites.has(source)) return true;
  }
  return false;
}

function canMergeCycles(current: CycleSummary, next: CycleSummary, grid: GridSpec): boolean {
  for (const coordinate of next.occupied) {
    if (current.occupied.has(coordinate)) return false;
  }

  if (current.hasMemory && next.hasMemory) return false;
  if (hasRouteDependency(current, next, grid)) return false;
  if (hasRouteDependency(next, current, grid)) return false;
  return true;
}

function mergedCycleFromSummaries(
  currentCycle: CycleAst,
  current: CycleSummary,
  next: CycleSummary
): CycleAst {
  const mergedPlacements = [...current.placements, ...next.placements];
  return {
    ...currentCycle,
    statements: mergedPlacements.map((placement) => ({
      kind: 'at' as const,
      row: placement.row,
      col: placement.col,
      instruction: placement.instruction,
      span: placement.span
    }))
  };
}

export function applyLatencyHide(
  cycles: CycleAst[],
  grid: GridSpec,
  window: number
): CycleAst[] {
  if (!Number.isInteger(window) || window <= 0 || cycles.length <= 1) {
    return cycles.map((cycle, index) => ({ ...cycle, index }));
  }

  const compacted = cycles.map((cycle) => ({
    ...cycle,
    statements: [...cycle.statements]
  }));

  let cycleIndex = 0;
  while (cycleIndex < compacted.length - 1) {
    let mergedCount = 0;
    while (mergedCount < window && cycleIndex < compacted.length - 1) {
      const nextCycle = compacted[cycleIndex + 1];
      // Never absorb a labeled cycle as the "next" in a merge — its label
      // would be lost because mergedCycleFromSummaries only preserves the
      // label of the *current* (left) cycle.  Labeled cycles must stay as
      // the head of their own merge group so their label is retained.
      if (nextCycle.label) break;
      const currentSummary = summarizeCycle(compacted[cycleIndex], grid);
      const nextSummary = summarizeCycle(nextCycle, grid);
      if (!currentSummary || !nextSummary) break;
      if (!canMergeCycles(currentSummary, nextSummary, grid)) break;

      compacted[cycleIndex] = mergedCycleFromSummaries(
        compacted[cycleIndex],
        currentSummary,
        nextSummary
      );
      compacted.splice(cycleIndex + 1, 1);
      mergedCount++;
    }
    cycleIndex++;
  }

  return compacted.map((cycle, index) => ({
    ...cycle,
    index
  }));
}
