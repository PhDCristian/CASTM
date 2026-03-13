import { describe, expect, it } from 'vitest';
import { spanAt } from '@castm/compiler-ir';
import { parseLatencyHidePragmaArgs } from '../packages/compiler-api/src/passes-shared/advanced-args/optimizer.js';
import { applyLatencyHide } from '../packages/compiler-api/src/passes-shared/expand-pragmas/latency-hide.js';

const span = spanAt(1, 1, 1);
const grid: any = {
  rows: 4,
  cols: 4,
  topology: 'torus',
  wrapPolicy: 'wrap'
};

const meshGrid: any = {
  rows: 4,
  cols: 4,
  topology: 'mesh',
  wrapPolicy: 'clamp'
};

function instruction(opcode: string | null, text: string, operands: string[]): any {
  return {
    opcode,
    text,
    operands,
    span
  };
}

function at(row: number, col: number, inst: any): any {
  return {
    kind: 'at',
    row,
    col,
    instruction: inst,
    span
  };
}

function cycle(index: number, statements: any[]): any {
  return {
    index,
    statements,
    span
  };
}

describe('compiler-api latency_hide parser + scheduler', () => {
  it('parses canonical latency_hide args and rejects malformed variants', () => {
    expect(parseLatencyHidePragmaArgs('latency_hide(window=2, mode=conservative)')).toEqual({
      window: 2,
      mode: 'conservative'
    });
    expect(parseLatencyHidePragmaArgs('latency_hide(window=1)')).toEqual({
      window: 1,
      mode: 'conservative'
    });
    expect(parseLatencyHidePragmaArgs('latency_hide(mode=conservative)')).toEqual({
      window: 1,
      mode: 'conservative'
    });

    expect(parseLatencyHidePragmaArgs('latency_hide()')).toBeNull();
    expect(parseLatencyHidePragmaArgs('latency_hide(window=0)')).toBeNull();
    expect(parseLatencyHidePragmaArgs('latency_hide(window=9)')).toEqual({
      window: 9,
      mode: 'conservative'
    });
    expect(parseLatencyHidePragmaArgs('latency_hide(window=257)')).toBeNull();
    expect(parseLatencyHidePragmaArgs('latency_hide(mode=aggressive)')).toBeNull();
    expect(parseLatencyHidePragmaArgs('latency_hide(extra=1)')).toBeNull();
    expect(parseLatencyHidePragmaArgs('latency_hide(window=1 mode=conservative)')).toBeNull();
    expect(parseLatencyHidePragmaArgs('latency_hide(window=1,)')).toBeNull();
    expect(parseLatencyHidePragmaArgs('route(@0,1 -> @0,0, payload=R1, accum=R2)')).toBeNull();
  });

  it('returns reindexed cycles when compaction is disabled or inapplicable', () => {
    const one = [cycle(5, [at(0, 0, instruction('NOP', 'NOP', []))])];
    expect(applyLatencyHide(one, grid, 0)[0].index).toBe(0);
    expect(applyLatencyHide(one, grid, -1)[0].index).toBe(0);
    expect(applyLatencyHide(one, grid, 1)[0].index).toBe(0);
  });

  it('compacts independent adjacent cycles (including memory hidden into compute slot)', () => {
    const cycles = [
      cycle(0, [at(1, 0, instruction('SMUL', 'SMUL R2, R0, R1', ['R2', 'R0', 'R1']))]),
      cycle(1, [at(0, 3, instruction('LWI', 'LWI R1, 4', ['R1', '4']))])
    ];

    const compacted = applyLatencyHide(cycles, grid, 1);
    expect(compacted).toHaveLength(1);
    expect(compacted[0].index).toBe(0);
    expect(compacted[0].statements).toHaveLength(2);
  });

  it('supports window > 1 for chained compaction', () => {
    const cycles = [
      cycle(0, [at(0, 0, instruction('SADD', 'SADD R1, R0, ZERO', ['R1', 'R0', 'ZERO']))]),
      cycle(1, [at(0, 1, instruction('SADD', 'SADD R2, R3, ZERO', ['R2', 'R3', 'ZERO']))]),
      cycle(2, [at(0, 2, instruction('SADD', 'SADD R4, R5, ZERO', ['R4', 'R5', 'ZERO']))])
    ];

    const compacted = applyLatencyHide(cycles, grid, 2);
    expect(compacted).toHaveLength(1);
    expect(compacted[0].statements).toHaveLength(3);
  });

  it('keeps cycles separate for occupancy, route and dual-memory hazards', () => {
    const occupancy = applyLatencyHide([
      cycle(0, [at(0, 0, instruction('SADD', 'SADD R1, R0, ZERO', ['R1', 'R0', 'ZERO']))]),
      cycle(1, [at(0, 0, instruction('LWI', 'LWI R2, 4', ['R2', '4']))])
    ], grid, 1);
    expect(occupancy).toHaveLength(2);

    const routeHazard = applyLatencyHide([
      cycle(0, [at(0, 0, instruction('SADD', 'SADD ROUT, R1, ZERO', ['ROUT', 'R1', 'ZERO']))]),
      cycle(1, [at(0, 1, instruction('SADD', 'SADD R2, RCL, ZERO', ['R2', 'RCL', 'ZERO']))])
    ], grid, 1);
    expect(routeHazard).toHaveLength(2);

    const dualMemory = applyLatencyHide([
      cycle(0, [at(0, 0, instruction('LWI', 'LWI R1, 4', ['R1', '4']))]),
      cycle(1, [at(0, 1, instruction('SWI', 'SWI R2, 8', ['R2', '8']))])
    ], grid, 1);
    expect(dualMemory).toHaveLength(2);
  });

  it('packs independent route-writes and independent incoming-reads', () => {
    const routeWrites = applyLatencyHide([
      cycle(0, [at(0, 0, instruction('SADD', 'SADD ROUT, R1, ZERO', ['ROUT', 'R1', 'ZERO']))]),
      cycle(1, [at(2, 2, instruction('SADD', 'SADD ROUT, R3, ZERO', ['ROUT', 'R3', 'ZERO']))])
    ], grid, 1);
    expect(routeWrites).toHaveLength(1);

    const incomingReads = applyLatencyHide([
      cycle(0, [at(0, 1, instruction('SADD', 'SADD R2, RCL, ZERO', ['R2', 'RCL', 'ZERO']))]),
      cycle(1, [at(2, 3, instruction('SADD', 'SADD R4, RCL, ZERO', ['R4', 'RCL', 'ZERO']))])
    ], grid, 1);
    expect(incomingReads).toHaveLength(1);
  });

  it('handles non-wrap incoming dependency checks for mesh boundaries', () => {
    const noSourceAtBoundary = applyLatencyHide([
      cycle(0, [at(0, 2, instruction('SADD', 'SADD ROUT, R1, ZERO', ['ROUT', 'R1', 'ZERO']))]),
      cycle(1, [at(0, 0, instruction('SADD', 'SADD R2, RCL, ZERO', ['R2', 'RCL', 'ZERO']))])
    ], meshGrid, 1);
    expect(noSourceAtBoundary).toHaveLength(1);

    const inBoundsDependency = applyLatencyHide([
      cycle(0, [at(0, 0, instruction('SADD', 'SADD ROUT, R1, ZERO', ['ROUT', 'R1', 'ZERO']))]),
      cycle(1, [at(0, 1, instruction('SADD', 'SADD R2, RCL, ZERO', ['R2', 'RCL', 'ZERO']))])
    ], meshGrid, 1);
    expect(inBoundsDependency).toHaveLength(2);
  });

  it('covers route incoming directions and reverse-dependency guard', () => {
    const rcrDependency = applyLatencyHide([
      cycle(0, [at(0, 2, instruction('SADD', 'SADD ROUT, R1, ZERO', ['ROUT', 'R1', 'ZERO']))]),
      cycle(1, [at(0, 1, instruction('SADD', 'SADD R2, RCR, ZERO', ['R2', 'RCR', 'ZERO']))])
    ], grid, 1);
    expect(rcrDependency).toHaveLength(2);

    const rctDependency = applyLatencyHide([
      cycle(0, [at(0, 0, instruction('SADD', 'SADD ROUT, R1, ZERO', ['ROUT', 'R1', 'ZERO']))]),
      cycle(1, [at(1, 0, instruction('SADD', 'SADD R2, RCT, ZERO', ['R2', 'RCT', 'ZERO']))])
    ], grid, 1);
    expect(rctDependency).toHaveLength(2);

    const rcbDependency = applyLatencyHide([
      cycle(0, [at(2, 0, instruction('SADD', 'SADD ROUT, R1, ZERO', ['ROUT', 'R1', 'ZERO']))]),
      cycle(1, [at(1, 0, instruction('SADD', 'SADD R2, RCB, ZERO', ['R2', 'RCB', 'ZERO']))])
    ], grid, 1);
    expect(rcbDependency).toHaveLength(2);

    const incomingToken = applyLatencyHide([
      cycle(0, [at(0, 0, instruction('SADD', 'SADD ROUT, R1, ZERO', ['ROUT', 'R1', 'ZERO']))]),
      cycle(1, [at(2, 2, instruction('SADD', 'SADD R2, INCOMING, ZERO', ['R2', 'INCOMING', 'ZERO']))])
    ], grid, 1);
    expect(incomingToken).toHaveLength(1);

    const reverseDependency = applyLatencyHide([
      cycle(0, [at(0, 1, instruction('SADD', 'SADD R2, RCL, ZERO', ['R2', 'RCL', 'ZERO']))]),
      cycle(1, [at(0, 0, instruction('SADD', 'SADD ROUT, R1, ZERO', ['ROUT', 'R1', 'ZERO']))])
    ], grid, 1);
    expect(reverseDependency).toHaveLength(2);
  });

  it('treats control/unknown instructions and unresolved spatial forms as non-compactable', () => {
    const control = applyLatencyHide([
      cycle(0, [at(0, 0, instruction('BEQ', 'BEQ R0, ZERO, L0', ['R0', 'ZERO', 'L0']))]),
      cycle(1, [at(0, 1, instruction('NOP', 'NOP', []))])
    ], grid, 1);
    expect(control).toHaveLength(2);

    const unknown = applyLatencyHide([
      cycle(0, [at(0, 0, instruction('FOO', 'FOO R1, R2, R3', ['R1', 'R2', 'R3']))]),
      cycle(1, [at(0, 1, instruction('NOP', 'NOP', []))])
    ], grid, 1);
    expect(unknown).toHaveLength(2);

    const atExpr = applyLatencyHide([
      cycle(0, [{
        kind: 'at-expr',
        rowExpr: 'i',
        colExpr: 'j',
        instruction: instruction('SADD', 'SADD R1, R0, ZERO', ['R1', 'R0', 'ZERO']),
        span
      }]),
      cycle(1, [at(0, 1, instruction('NOP', 'NOP', []))])
    ], grid, 1);
    expect(atExpr).toHaveLength(2);
  });

  it('handles row/col/all forms and keeps invalid row indices unmerged', () => {
    const rowColAll = applyLatencyHide([
      cycle(0, [{
        kind: 'row',
        row: 1,
        instructions: [
          instruction('NOP', 'NOP', []),
          instruction('SADD', 'SADD R1, R0, ZERO', ['R1', 'R0', 'ZERO'])
        ],
        span
      }]),
      cycle(1, [{
        kind: 'col',
        col: 3,
        instruction: instruction('NOP', 'NOP', []),
        span
      }]),
      cycle(2, [{
        kind: 'all',
        instruction: instruction('NOP', 'NOP', []),
        span
      }])
    ], grid, 2);
    expect(rowColAll).toHaveLength(1);
    expect(rowColAll[0].statements.length).toBeGreaterThanOrEqual(1);

    const invalidRow = applyLatencyHide([
      cycle(0, [{
        kind: 'row',
        row: 99,
        instructions: [instruction('SADD', 'SADD R1, R0, ZERO', ['R1', 'R0', 'ZERO'])],
        span
      }]),
      cycle(1, [at(0, 1, instruction('SADD', 'SADD R2, R3, ZERO', ['R2', 'R3', 'ZERO']))])
    ], grid, 1);
    expect(invalidRow).toHaveLength(2);

    const invalidCol = applyLatencyHide([
      cycle(0, [{
        kind: 'col',
        col: 99,
        instruction: instruction('SADD', 'SADD R1, R0, ZERO', ['R1', 'R0', 'ZERO']),
        span
      }]),
      cycle(1, [at(0, 1, instruction('SADD', 'SADD R2, R3, ZERO', ['R2', 'R3', 'ZERO']))])
    ], grid, 1);
    expect(invalidCol).toHaveLength(2);
  });

  it('supports LWD/SWD access summaries in conservative compaction', () => {
    const lwd = applyLatencyHide([
      cycle(0, [at(0, 0, instruction('LWD', 'LWD R1', ['R1']))]),
      cycle(1, [at(0, 1, instruction('SADD', 'SADD R2, R3, ZERO', ['R2', 'R3', 'ZERO']))])
    ], grid, 1);
    expect(lwd).toHaveLength(1);

    const swd = applyLatencyHide([
      cycle(0, [at(0, 0, instruction('SWD', 'SWD R1', ['R1']))]),
      cycle(1, [at(0, 1, instruction('SADD', 'SADD R2, R3, ZERO', ['R2', 'R3', 'ZERO']))])
    ], grid, 1);
    expect(swd).toHaveLength(1);
  });

  it('covers malformed memory/write-first operands as non-compactable safeguards', () => {
    const invalidLwiDest = applyLatencyHide([
      cycle(0, [at(0, 0, instruction('LWI', 'LWI 1, 4', ['1', '4']))]),
      cycle(1, [at(0, 1, instruction('SADD', 'SADD R2, R3, ZERO', ['R2', 'R3', 'ZERO']))])
    ], grid, 1);
    expect(invalidLwiDest).toHaveLength(2);

    const lwiMissingAddr = applyLatencyHide([
      cycle(0, [at(0, 0, instruction('LWI', 'LWI R1', ['R1']))]),
      cycle(1, [at(0, 1, instruction('SADD', 'SADD R2, R3, ZERO', ['R2', 'R3', 'ZERO']))])
    ], grid, 1);
    expect(lwiMissingAddr).toHaveLength(1);

    const swiMissingOperands = applyLatencyHide([
      cycle(0, [at(0, 0, instruction('SWI', 'SWI', []))]),
      cycle(1, [at(0, 1, instruction('SADD', 'SADD R2, R3, ZERO', ['R2', 'R3', 'ZERO']))])
    ], grid, 1);
    expect(swiMissingOperands).toHaveLength(1);

    const invalidWriteFirst = applyLatencyHide([
      cycle(0, [at(0, 0, instruction('SADD', 'SADD', []))]),
      cycle(1, [at(0, 1, instruction('SADD', 'SADD R2, R3, ZERO', ['R2', 'R3', 'ZERO']))])
    ], grid, 1);
    expect(invalidWriteFirst).toHaveLength(2);

    const invalidLwd = applyLatencyHide([
      cycle(0, [at(0, 0, instruction('LWD', 'LWD', []))]),
      cycle(1, [at(0, 1, instruction('SADD', 'SADD R2, R3, ZERO', ['R2', 'R3', 'ZERO']))])
    ], grid, 1);
    expect(invalidLwd).toHaveLength(2);

    const swdMissingSrc = applyLatencyHide([
      cycle(0, [at(0, 0, instruction('SWD', 'SWD', []))]),
      cycle(1, [at(0, 1, instruction('SADD', 'SADD R2, R3, ZERO', ['R2', 'R3', 'ZERO']))])
    ], grid, 1);
    expect(swdMissingSrc).toHaveLength(1);
  });
});
