import { describe, expect, it } from 'vitest';
import { spanAt } from '@castm/compiler-ir';
import { parseLatencyHideAdvancedStatementArgs } from '../packages/compiler-api/src/passes-shared/advanced-args/optimizer.js';
import { applyLatencyHide } from '../packages/compiler-api/src/passes-shared/expand-advanced-statements/latency-hide.js';

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

function bundle(index: number, statements: any[]): any {
  return {
    index,
    statements,
    span
  };
}

describe('compiler-api latency_hide parser + scheduler', () => {
  it('parses canonical latency_hide args and rejects malformed variants', () => {
    expect(parseLatencyHideAdvancedStatementArgs('latency_hide(window=2, mode=conservative)')).toEqual({
      window: 2,
      mode: 'conservative'
    });
    expect(parseLatencyHideAdvancedStatementArgs('latency_hide(window=1)')).toEqual({
      window: 1,
      mode: 'conservative'
    });
    expect(parseLatencyHideAdvancedStatementArgs('latency_hide(mode=conservative)')).toEqual({
      window: 1,
      mode: 'conservative'
    });

    expect(parseLatencyHideAdvancedStatementArgs('latency_hide()')).toBeNull();
    expect(parseLatencyHideAdvancedStatementArgs('latency_hide(window=0)')).toBeNull();
    expect(parseLatencyHideAdvancedStatementArgs('latency_hide(window=9)')).toEqual({
      window: 9,
      mode: 'conservative'
    });
    expect(parseLatencyHideAdvancedStatementArgs('latency_hide(window=257)')).toBeNull();
    expect(parseLatencyHideAdvancedStatementArgs('latency_hide(mode=aggressive)')).toBeNull();
    expect(parseLatencyHideAdvancedStatementArgs('latency_hide(extra=1)')).toBeNull();
    expect(parseLatencyHideAdvancedStatementArgs('latency_hide(window=1 mode=conservative)')).toBeNull();
    expect(parseLatencyHideAdvancedStatementArgs('latency_hide(window=1,)')).toBeNull();
    expect(parseLatencyHideAdvancedStatementArgs('route(@0,1 -> @0,0, payload=R1, accum=R2)')).toBeNull();
  });

  it('returns reindexed bundles when compaction is disabled or inapplicable', () => {
    const one = [bundle(5, [at(0, 0, instruction('NOP', 'NOP', []))])];
    expect(applyLatencyHide(one, grid, 0)[0].index).toBe(0);
    expect(applyLatencyHide(one, grid, -1)[0].index).toBe(0);
    expect(applyLatencyHide(one, grid, 1)[0].index).toBe(0);
  });

  it('compacts independent adjacent bundles (including memory hidden into compute slot)', () => {
    const bundles = [
      bundle(0, [at(1, 0, instruction('SMUL', 'SMUL R2, R0, R1', ['R2', 'R0', 'R1']))]),
      bundle(1, [at(0, 3, instruction('LWI', 'LWI R1, 4', ['R1', '4']))])
    ];

    const compacted = applyLatencyHide(bundles, grid, 1);
    expect(compacted).toHaveLength(1);
    expect(compacted[0].index).toBe(0);
    expect(compacted[0].statements).toHaveLength(2);
  });

  it('supports window > 1 for chained compaction', () => {
    const bundles = [
      bundle(0, [at(0, 0, instruction('SADD', 'SADD R1, R0, ZERO', ['R1', 'R0', 'ZERO']))]),
      bundle(1, [at(0, 1, instruction('SADD', 'SADD R2, R3, ZERO', ['R2', 'R3', 'ZERO']))]),
      bundle(2, [at(0, 2, instruction('SADD', 'SADD R4, R5, ZERO', ['R4', 'R5', 'ZERO']))])
    ];

    const compacted = applyLatencyHide(bundles, grid, 2);
    expect(compacted).toHaveLength(1);
    expect(compacted[0].statements).toHaveLength(3);
  });

  it('keeps bundles separate for occupancy, route and dual-memory hazards', () => {
    const occupancy = applyLatencyHide([
      bundle(0, [at(0, 0, instruction('SADD', 'SADD R1, R0, ZERO', ['R1', 'R0', 'ZERO']))]),
      bundle(1, [at(0, 0, instruction('LWI', 'LWI R2, 4', ['R2', '4']))])
    ], grid, 1);
    expect(occupancy).toHaveLength(2);

    const routeHazard = applyLatencyHide([
      bundle(0, [at(0, 0, instruction('SADD', 'SADD ROUT, R1, ZERO', ['ROUT', 'R1', 'ZERO']))]),
      bundle(1, [at(0, 1, instruction('SADD', 'SADD R2, RCL, ZERO', ['R2', 'RCL', 'ZERO']))])
    ], grid, 1);
    expect(routeHazard).toHaveLength(2);

    const dualMemory = applyLatencyHide([
      bundle(0, [at(0, 0, instruction('LWI', 'LWI R1, 4', ['R1', '4']))]),
      bundle(1, [at(0, 1, instruction('SWI', 'SWI R2, 8', ['R2', '8']))])
    ], grid, 1);
    expect(dualMemory).toHaveLength(2);
  });

  it('packs independent route-writes and independent incoming-reads', () => {
    const routeWrites = applyLatencyHide([
      bundle(0, [at(0, 0, instruction('SADD', 'SADD ROUT, R1, ZERO', ['ROUT', 'R1', 'ZERO']))]),
      bundle(1, [at(2, 2, instruction('SADD', 'SADD ROUT, R3, ZERO', ['ROUT', 'R3', 'ZERO']))])
    ], grid, 1);
    expect(routeWrites).toHaveLength(1);

    const incomingReads = applyLatencyHide([
      bundle(0, [at(0, 1, instruction('SADD', 'SADD R2, RCL, ZERO', ['R2', 'RCL', 'ZERO']))]),
      bundle(1, [at(2, 3, instruction('SADD', 'SADD R4, RCL, ZERO', ['R4', 'RCL', 'ZERO']))])
    ], grid, 1);
    expect(incomingReads).toHaveLength(1);
  });

  it('handles non-wrap incoming dependency checks for mesh boundaries', () => {
    const noSourceAtBoundary = applyLatencyHide([
      bundle(0, [at(0, 2, instruction('SADD', 'SADD ROUT, R1, ZERO', ['ROUT', 'R1', 'ZERO']))]),
      bundle(1, [at(0, 0, instruction('SADD', 'SADD R2, RCL, ZERO', ['R2', 'RCL', 'ZERO']))])
    ], meshGrid, 1);
    expect(noSourceAtBoundary).toHaveLength(1);

    const inBoundsDependency = applyLatencyHide([
      bundle(0, [at(0, 0, instruction('SADD', 'SADD ROUT, R1, ZERO', ['ROUT', 'R1', 'ZERO']))]),
      bundle(1, [at(0, 1, instruction('SADD', 'SADD R2, RCL, ZERO', ['R2', 'RCL', 'ZERO']))])
    ], meshGrid, 1);
    expect(inBoundsDependency).toHaveLength(2);
  });

  it('covers route incoming directions and reverse-dependency guard', () => {
    const rcrDependency = applyLatencyHide([
      bundle(0, [at(0, 2, instruction('SADD', 'SADD ROUT, R1, ZERO', ['ROUT', 'R1', 'ZERO']))]),
      bundle(1, [at(0, 1, instruction('SADD', 'SADD R2, RCR, ZERO', ['R2', 'RCR', 'ZERO']))])
    ], grid, 1);
    expect(rcrDependency).toHaveLength(2);

    const rctDependency = applyLatencyHide([
      bundle(0, [at(0, 0, instruction('SADD', 'SADD ROUT, R1, ZERO', ['ROUT', 'R1', 'ZERO']))]),
      bundle(1, [at(1, 0, instruction('SADD', 'SADD R2, RCT, ZERO', ['R2', 'RCT', 'ZERO']))])
    ], grid, 1);
    expect(rctDependency).toHaveLength(2);

    const rcbDependency = applyLatencyHide([
      bundle(0, [at(2, 0, instruction('SADD', 'SADD ROUT, R1, ZERO', ['ROUT', 'R1', 'ZERO']))]),
      bundle(1, [at(1, 0, instruction('SADD', 'SADD R2, RCB, ZERO', ['R2', 'RCB', 'ZERO']))])
    ], grid, 1);
    expect(rcbDependency).toHaveLength(2);

    const incomingToken = applyLatencyHide([
      bundle(0, [at(0, 0, instruction('SADD', 'SADD ROUT, R1, ZERO', ['ROUT', 'R1', 'ZERO']))]),
      bundle(1, [at(2, 2, instruction('SADD', 'SADD R2, INCOMING, ZERO', ['R2', 'INCOMING', 'ZERO']))])
    ], grid, 1);
    expect(incomingToken).toHaveLength(1);

    const reverseDependency = applyLatencyHide([
      bundle(0, [at(0, 1, instruction('SADD', 'SADD R2, RCL, ZERO', ['R2', 'RCL', 'ZERO']))]),
      bundle(1, [at(0, 0, instruction('SADD', 'SADD ROUT, R1, ZERO', ['ROUT', 'R1', 'ZERO']))])
    ], grid, 1);
    expect(reverseDependency).toHaveLength(2);
  });

  it('treats control/unknown instructions and unresolved spatial forms as non-compactable', () => {
    const control = applyLatencyHide([
      bundle(0, [at(0, 0, instruction('BEQ', 'BEQ R0, ZERO, L0', ['R0', 'ZERO', 'L0']))]),
      bundle(1, [at(0, 1, instruction('NOP', 'NOP', []))])
    ], grid, 1);
    expect(control).toHaveLength(2);

    const unknown = applyLatencyHide([
      bundle(0, [at(0, 0, instruction('FOO', 'FOO R1, R2, R3', ['R1', 'R2', 'R3']))]),
      bundle(1, [at(0, 1, instruction('NOP', 'NOP', []))])
    ], grid, 1);
    expect(unknown).toHaveLength(2);

    const atExpr = applyLatencyHide([
      bundle(0, [{
        kind: 'at-expr',
        rowExpr: 'i',
        colExpr: 'j',
        instruction: instruction('SADD', 'SADD R1, R0, ZERO', ['R1', 'R0', 'ZERO']),
        span
      }]),
      bundle(1, [at(0, 1, instruction('NOP', 'NOP', []))])
    ], grid, 1);
    expect(atExpr).toHaveLength(2);
  });

  it('handles row/col/all forms and keeps invalid row indices unmerged', () => {
    const rowColAll = applyLatencyHide([
      bundle(0, [{
        kind: 'row',
        row: 1,
        instructions: [
          instruction('NOP', 'NOP', []),
          instruction('SADD', 'SADD R1, R0, ZERO', ['R1', 'R0', 'ZERO'])
        ],
        span
      }]),
      bundle(1, [{
        kind: 'col',
        col: 3,
        instruction: instruction('NOP', 'NOP', []),
        span
      }]),
      bundle(2, [{
        kind: 'all',
        instruction: instruction('NOP', 'NOP', []),
        span
      }])
    ], grid, 2);
    expect(rowColAll).toHaveLength(1);
    expect(rowColAll[0].statements.length).toBeGreaterThanOrEqual(1);

    const invalidRow = applyLatencyHide([
      bundle(0, [{
        kind: 'row',
        row: 99,
        instructions: [instruction('SADD', 'SADD R1, R0, ZERO', ['R1', 'R0', 'ZERO'])],
        span
      }]),
      bundle(1, [at(0, 1, instruction('SADD', 'SADD R2, R3, ZERO', ['R2', 'R3', 'ZERO']))])
    ], grid, 1);
    expect(invalidRow).toHaveLength(2);

    const invalidCol = applyLatencyHide([
      bundle(0, [{
        kind: 'col',
        col: 99,
        instruction: instruction('SADD', 'SADD R1, R0, ZERO', ['R1', 'R0', 'ZERO']),
        span
      }]),
      bundle(1, [at(0, 1, instruction('SADD', 'SADD R2, R3, ZERO', ['R2', 'R3', 'ZERO']))])
    ], grid, 1);
    expect(invalidCol).toHaveLength(2);
  });

  it('supports LWD/SWD access summaries in conservative compaction', () => {
    const lwd = applyLatencyHide([
      bundle(0, [at(0, 0, instruction('LWD', 'LWD R1', ['R1']))]),
      bundle(1, [at(0, 1, instruction('SADD', 'SADD R2, R3, ZERO', ['R2', 'R3', 'ZERO']))])
    ], grid, 1);
    expect(lwd).toHaveLength(1);

    const swd = applyLatencyHide([
      bundle(0, [at(0, 0, instruction('SWD', 'SWD R1', ['R1']))]),
      bundle(1, [at(0, 1, instruction('SADD', 'SADD R2, R3, ZERO', ['R2', 'R3', 'ZERO']))])
    ], grid, 1);
    expect(swd).toHaveLength(1);
  });

  it('covers malformed memory/write-first operands as non-compactable safeguards', () => {
    const invalidLwiDest = applyLatencyHide([
      bundle(0, [at(0, 0, instruction('LWI', 'LWI 1, 4', ['1', '4']))]),
      bundle(1, [at(0, 1, instruction('SADD', 'SADD R2, R3, ZERO', ['R2', 'R3', 'ZERO']))])
    ], grid, 1);
    expect(invalidLwiDest).toHaveLength(2);

    const lwiMissingAddr = applyLatencyHide([
      bundle(0, [at(0, 0, instruction('LWI', 'LWI R1', ['R1']))]),
      bundle(1, [at(0, 1, instruction('SADD', 'SADD R2, R3, ZERO', ['R2', 'R3', 'ZERO']))])
    ], grid, 1);
    expect(lwiMissingAddr).toHaveLength(1);

    const swiMissingOperands = applyLatencyHide([
      bundle(0, [at(0, 0, instruction('SWI', 'SWI', []))]),
      bundle(1, [at(0, 1, instruction('SADD', 'SADD R2, R3, ZERO', ['R2', 'R3', 'ZERO']))])
    ], grid, 1);
    expect(swiMissingOperands).toHaveLength(1);

    const invalidWriteFirst = applyLatencyHide([
      bundle(0, [at(0, 0, instruction('SADD', 'SADD', []))]),
      bundle(1, [at(0, 1, instruction('SADD', 'SADD R2, R3, ZERO', ['R2', 'R3', 'ZERO']))])
    ], grid, 1);
    expect(invalidWriteFirst).toHaveLength(2);

    const invalidLwd = applyLatencyHide([
      bundle(0, [at(0, 0, instruction('LWD', 'LWD', []))]),
      bundle(1, [at(0, 1, instruction('SADD', 'SADD R2, R3, ZERO', ['R2', 'R3', 'ZERO']))])
    ], grid, 1);
    expect(invalidLwd).toHaveLength(2);

    const swdMissingSrc = applyLatencyHide([
      bundle(0, [at(0, 0, instruction('SWD', 'SWD', []))]),
      bundle(1, [at(0, 1, instruction('SADD', 'SADD R2, R3, ZERO', ['R2', 'R3', 'ZERO']))])
    ], grid, 1);
    expect(swdMissingSrc).toHaveLength(1);
  });
});
