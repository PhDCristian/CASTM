import { describe, expect, it } from 'vitest';
import { compile } from '@castm/compiler-api';
import { ErrorCodes } from '@castm/compiler-ir';

function csvRows(csv: string): string[] {
  return csv.trim().split('\n').slice(1);
}

function parseCsvRow(row: string): { cycle: number; peRow: number; col: number; instruction: string } {
  const [cycle, peRow, col, ...instruction] = row.split(',');
  return {
    cycle: Number(cycle),
    peRow: Number(peRow),
    col: Number(col),
    instruction: instruction.join(',')
  };
}

describe('issues/FEAT-16 pipeline macro statement', () => {
  it('expands pipeline(...) into ordered function call sequence', () => {
    const source = `
target "uma-cgra-base";
build { expansion_mode full-unroll; }

function stage_load(src) {
  bundle { @0,0: SADD R2, src, ZERO; }
}

function stage_mix(dst) {
  bundle { @0,1: SADD dst, R2, ZERO; }
}

kernel "feat16_pipeline" {
  pipeline(stage_load(R0), stage_mix(R3));
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);

    const rows = csvRows(result.artifacts.csv ?? '');
    expect(rows).toHaveLength(2);
    const first = parseCsvRow(rows[0]);
    const second = parseCsvRow(rows[1]);
    expect(first.peRow).toBe(0);
    expect(first.col).toBe(0);
    expect(first.instruction).toBe('SADD R2 R0 ZERO');
    expect(second.peRow).toBe(0);
    expect(second.col).toBe(1);
    expect(second.instruction).toBe('SADD R3 R2 ZERO');
    expect(second.cycle).toBeGreaterThanOrEqual(first.cycle);
  });

  it('supports pipeline steps with mixed argument arity', () => {
    const source = `
target "uma-cgra-base";
build { expansion_mode full-unroll; }

function step0() {
  bundle { @0,0: NOP; }
}

function step1(a, b) {
  bundle { @0,1: SADD R1, a, b; }
}

kernel "feat16_arity" {
  pipeline(step0(), step1(R0, R3));
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);
    const csv = result.artifacts.csv ?? '';
    expect(csv).toMatch(/\n\d+,0,0,NOP(?:\n|$)/);
    expect(csv).toMatch(/\n\d+,0,1,SADD R1 R0 R3(?:\n|$)/);
  });

  it('does not assume cross-PE register-name dependency between stages', () => {
    const source = `
target "uma-cgra-base";
build { expansion_mode full-unroll; }

function s0(v) {
  bundle { @0,0: SADD R1, v, ZERO; }
}

function s1(v) {
  bundle { @0,1: SADD R2, v, R1; }
}

function s2(v) {
  bundle { @0,2: SADD R3, v, R2; }
}

kernel "feat16_cross_pe_local_regs" {
  pipeline(s0(R0), s1(R0), s2(R0));
}
`;

    const packed = compile(source, { schedulerWindow: 2 });
    expect(packed.success).toBe(true);
    const csv = packed.artifacts.csv ?? '';
    expect(csv).toMatch(/\n0,0,0,SADD R1 R0 ZERO(?:\n|$)/);
    expect(csv).toMatch(/\n0,0,1,SADD R2 R0 R1(?:\n|$)/);
    expect(csv).toMatch(/\n0,0,2,SADD R3 R0 R2(?:\n|$)/);
  });

  it('rejects malformed pipeline statements and non-function entries', () => {
    const empty = compile(`
target "uma-cgra-base";
kernel "feat16_empty" {
  pipeline();
}
`);
    expect(empty.success).toBe(false);
    expect(empty.diagnostics.some((d) => d.code === ErrorCodes.Parse.InvalidSyntax)).toBe(true);

    const badEntry = compile(`
target "uma-cgra-base";
kernel "feat16_bad_entry" {
  pipeline(step0, step1());
}
`);
    expect(badEntry.success).toBe(false);
    expect(badEntry.diagnostics.some((d) => d.code === ErrorCodes.Parse.InvalidSyntax)).toBe(true);

    const advancedInside = compile(`
target "uma-cgra-base";
kernel "feat16_advanced_inside" {
  pipeline(route(@0,1 -> @0,0, payload=R3, accum=R1));
}
`);
    expect(advancedInside.success).toBe(false);
    expect(advancedInside.diagnostics.some((d) => d.code === ErrorCodes.Parse.InvalidSyntax)).toBe(true);
  });
});
