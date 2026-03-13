import { describe, expect, it } from 'vitest';
import { compile } from '@castm/compiler-api';

function countInstruction(csv: string, instruction: string): number {
  return csv
    .trim()
    .split('\n')
    .slice(1)
    .filter((line) => line.endsWith(`,${instruction}`)).length;
}

describe('issues/FEAT-18 expansion mode', () => {
  it.each(['full-unroll', 'jump-reuse'] as const)(
    'preserves functional behavior in %s mode for equivalent calls',
    (mode) => {
      const source = `
target "uma-cgra-base";
build { expansion_mode ${mode}; }

function stage(src) {
  bundle { @0,1: SADD R2, src, ZERO; }
}

kernel "feat18_mode_parity" {
  pipeline(stage(R0), stage(R1));
}
`;

      const result = compile(source);
      expect(result.success).toBe(true);

      const csv = result.artifacts.csv ?? '';
      expect(countInstruction(csv, 'SADD R2 R0 ZERO')).toBe(1);
      expect(countInstruction(csv, 'SADD R2 R1 ZERO')).toBe(1);
    }
  );

  it('reuses a single function specialization per call signature in jump-reuse mode', () => {
    const source = `
target "uma-cgra-base";
build { expansion_mode jump-reuse; }

function stage(src) {
  bundle { @0,1: SADD R2, src, ZERO; }
}

kernel "feat18_jump_reuse" {
  pipeline(stage(R0), stage(R0));
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);

    const csv = result.artifacts.csv ?? '';
    // Body emitted once (shared specialization)
    expect(countInstruction(csv, 'SADD R2 R0 ZERO')).toBe(1);
    // Register-based call: SADD R3 sets return address, JUMP ZERO,R3 returns
    expect(csv).toMatch(/SADD R3 ZERO \d+/);
    expect(csv).toMatch(/JUMP ZERO R3/);
    // No SWI-based dispatch table
    expect(csv).not.toContain('SWI 1 262140');
    expect(csv).not.toMatch(/BEQ ROUT/);
  });

  it('uses full-unroll as default and allows explicit jump-reuse override', () => {
    const source = `
target "uma-cgra-base";

function stage(src) {
  bundle { @0,1: SADD R2, src, ZERO; }
}

kernel "feat18_default_unroll" {
  pipeline(stage(R0), stage(R0));
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);

    const csv = result.artifacts.csv ?? '';
    expect(countInstruction(csv, 'SADD R2 R0 ZERO')).toBe(2);
    expect(csv).not.toContain('SWI 1 262140');

    const jumpReuseSource = `
target "uma-cgra-base";
build { expansion_mode jump-reuse; }

function stage(src) {
  bundle { @0,1: SADD R2, src, ZERO; }
}

kernel "feat18_default_unroll" {
  pipeline(stage(R0), stage(R0));
}
`;

    const jumpReuseResult = compile(jumpReuseSource);
    expect(jumpReuseResult.success).toBe(true);
    const jumpReuseCsv = jumpReuseResult.artifacts.csv ?? '';
    expect(countInstruction(jumpReuseCsv, 'SADD R2 R0 ZERO')).toBe(1);
    // Register-based return — no SWI dispatch
    expect(jumpReuseCsv).not.toContain('SWI 1 262140');
    expect(jumpReuseCsv).toMatch(/SADD R3 ZERO \d+/);
  });

  it('accepts nested function calls in jump-reuse mode with automatic nested inline expansion', () => {
    const source = `
target "uma-cgra-base";
build { expansion_mode jump-reuse; }

function leaf(src) {
  bundle { @0,0: SADD R3, src, ZERO; }
}

function mid(src) {
  leaf(src);
}

function wrapper(src) {
  mid(src);
}

kernel "feat18_nested_reject" {
  wrapper(R0);
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);
    const csv = result.artifacts.csv ?? '';
    expect(countInstruction(csv, 'SADD R3 R0 ZERO')).toBe(1);
    // Register-based return with SADD + JUMP pattern
    expect(csv).toMatch(/SADD R3 ZERO \d+/);
    expect(csv).toMatch(/JUMP ZERO R3/);
    // No SWI-based dispatch
    expect(csv).not.toContain('SWI 1 262140');
    expect(csv).not.toMatch(/BEQ ROUT/);
  });

  it('accepts nested function calls in full-unroll mode', () => {
    const source = `
target "uma-cgra-base";
build { expansion_mode full-unroll; }

function leaf(src) {
  bundle { @0,0: SADD R3, src, ZERO; }
}

function wrapper(src) {
  leaf(src);
}

kernel "feat18_nested_full_unroll" {
  wrapper(R0);
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);
    const csv = result.artifacts.csv ?? '';
    expect(countInstruction(csv, 'SADD R3 R0 ZERO')).toBe(1);
    expect(csv).not.toContain('SWI 1 262140');
  });
});
