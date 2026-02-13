import {
  CycleAst,
  CycleStatementAst,
  GridSpec,
  InstructionAst
} from '@openedge/compiler-ir';

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
  'RCB',
  'INCOMING'
]);

interface Placement {
  row: number;
  col: number;
  instruction: InstructionAst;
  span: CycleStatementAst['span'];
}

interface AccessSummary {
  reads: Set<string>;
  writes: Set<string>;
  hasMemory: boolean;
  readsIncoming: boolean;
  writesRoute: boolean;
}

interface CycleSummary {
  placements: Placement[];
  occupied: Set<string>;
  reads: Set<string>;
  writes: Set<string>;
  hasMemory: boolean;
  readsIncoming: boolean;
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
  let readsIncoming = false;

  const addReads = (operand: string) => {
    for (const token of extractIdentifierTokens(operand)) {
      reads.add(token);
      if (INCOMING_IDENTIFIERS.has(token)) readsIncoming = true;
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
      readsIncoming,
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
      readsIncoming,
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
      readsIncoming,
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
      readsIncoming,
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
    readsIncoming,
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
  let readsIncoming = false;
  let writesRoute = false;

  for (const placement of placements) {
    if (isNoopInstruction(placement.instruction)) continue;
    occupied.add(`${placement.row},${placement.col}`);

    const access = summarizeInstruction(placement.instruction);
    if (!access) return null;
    if (access.hasMemory) hasMemory = true;
    if (access.readsIncoming) readsIncoming = true;
    if (access.writesRoute) writesRoute = true;
    for (const token of access.reads) reads.add(token);
    for (const token of access.writes) writes.add(token);
  }

  return {
    placements: placements.filter((placement) => !isNoopInstruction(placement.instruction)),
    occupied,
    reads,
    writes,
    hasMemory,
    readsIncoming,
    writesRoute
  };
}

function canMergeCycles(current: CycleSummary, next: CycleSummary): boolean {
  for (const coordinate of next.occupied) {
    if (current.occupied.has(coordinate)) return false;
  }

  if (current.readsIncoming || current.writesRoute) return false;
  if (next.readsIncoming || next.writesRoute) return false;
  if (current.hasMemory && next.hasMemory) return false;
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
      const currentSummary = summarizeCycle(compacted[cycleIndex], grid);
      const nextSummary = summarizeCycle(compacted[cycleIndex + 1], grid);
      if (!currentSummary || !nextSummary) break;
      if (!canMergeCycles(currentSummary, nextSummary)) break;

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
