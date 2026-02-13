import { describe, expect, it } from 'vitest';
import { compile } from '@openedge/compiler-api';
import { ErrorCodes } from '@openedge/compiler-ir';

function csvRows(csv: string): string[] {
  return csv.trim().split('\n').slice(1);
}

describe('issues/FEAT-16 pipeline macro statement', () => {
  it('expands pipeline(...) into ordered function call sequence', () => {
    const source = `
target "uma-cgra-base";

function stage_load(src) {
  cycle { @0,0: SADD R2, src, ZERO; }
}

function stage_mix(dst) {
  cycle { @0,1: SADD dst, R2, ZERO; }
}

kernel "feat16_pipeline" {
  pipeline(stage_load(R0), stage_mix(R3));
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);

    const rows = csvRows(result.artifacts.csv ?? '');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toBe('0,0,0,SADD R2 R0 ZERO');
    expect(rows[1]).toBe('1,0,1,SADD R3 R2 ZERO');
  });

  it('supports pipeline steps with mixed argument arity', () => {
    const source = `
target "uma-cgra-base";

function step0() {
  cycle { @0,0: NOP; }
}

function step1(a, b) {
  cycle { @0,1: SADD R1, a, b; }
}

kernel "feat16_arity" {
  pipeline(step0(), step1(R0, R3));
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);
    const csv = result.artifacts.csv ?? '';
    expect(csv).toContain('0,0,0,NOP');
    expect(csv).toContain('1,0,1,SADD R1 R0 R3');
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
