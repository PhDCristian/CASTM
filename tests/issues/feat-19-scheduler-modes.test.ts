import { describe, expect, it } from 'vitest';
import { compile } from '@castm/compiler-api';

describe('FEAT-19 scheduler modes', () => {
  const baseKernel = `
target "uma-cgra-base";
kernel "scheduler_modes" {
  bundle { at @0,0: SADD R1, R0, 1; }
  bundle { at @0,1: SADD R2, R0, 1; }
}
`;

  it('keeps deterministic output for same mode and input', () => {
    const source = `
target "uma-cgra-base";
build { scheduler aggressive; }
kernel "scheduler_modes" {
  bundle { at @0,0: SADD R1, R0, 1; }
  bundle { at @0,1: SADD R2, R0, 1; }
}
`;
    const first = compile(source);
    const second = compile(source);

    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    expect(first.artifacts.csv).toBe(second.artifacts.csv);
    expect(first.stats.schedulerMode).toBe('aggressive');
    expect(first.stats.loweredPasses).toContain('scheduler:aggressive');
  });

  it('uses balanced mode by default (O2) and matches explicit balanced behavior', () => {
    const implicit = compile(baseKernel);
    const explicit = compile(`
target "uma-cgra-base";
build { scheduler balanced; }
kernel "scheduler_modes" {
  bundle { at @0,0: SADD R1, R0, 1; }
  bundle { at @0,1: SADD R2, R0, 1; }
}
`);

    expect(implicit.success).toBe(true);
    expect(explicit.success).toBe(true);
    expect(implicit.stats.schedulerMode).toBe('balanced');
    expect(explicit.stats.schedulerMode).toBe('balanced');
    expect(implicit.artifacts.csv).toBe(explicit.artifacts.csv);
    expect(implicit.stats.loweredPasses).toContain('scheduler:balanced');
    expect(implicit.stats.loweredPasses).not.toContain('scheduler:aggressive');
  });

  it('keeps observable instruction workload while allowing cycle compaction', () => {
    const safe = compile(`
target "uma-cgra-base";
build { scheduler safe; }
kernel "scheduler_modes" {
  bundle { at @0,0: SADD R1, R0, 1; }
  bundle { at @0,1: SADD R2, R0, 1; }
}
`);
    const balanced = compile(`
target "uma-cgra-base";
build { scheduler balanced; }
kernel "scheduler_modes" {
  bundle { at @0,0: SADD R1, R0, 1; }
  bundle { at @0,1: SADD R2, R0, 1; }
}
`);
    const aggressive = compile(`
target "uma-cgra-base";
build { scheduler aggressive; }
kernel "scheduler_modes" {
  bundle { at @0,0: SADD R1, R0, 1; }
  bundle { at @0,1: SADD R2, R0, 1; }
}
`);

    expect(safe.success).toBe(true);
    expect(balanced.success).toBe(true);
    expect(aggressive.success).toBe(true);

    expect(balanced.stats.instructions).toBe(safe.stats.instructions);
    expect(aggressive.stats.instructions).toBe(safe.stats.instructions);

    expect(balanced.stats.cycles).toBeLessThanOrEqual(safe.stats.cycles);
    expect(aggressive.stats.cycles).toBeLessThanOrEqual(balanced.stats.cycles);

    expect(balanced.stats.totalSlots).toBe(balanced.stats.cycles * 16);
    expect(aggressive.stats.totalSlots).toBe(aggressive.stats.cycles * 16);
    expect(balanced.stats.utilization).toBeGreaterThanOrEqual(safe.stats.utilization);
    expect(aggressive.stats.utilization).toBeGreaterThanOrEqual(balanced.stats.utilization);
  });
});
