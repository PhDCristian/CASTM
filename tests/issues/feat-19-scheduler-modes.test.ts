import { describe, expect, it } from 'vitest';
import { compile } from '@openedge/compiler-api';

describe('FEAT-19 scheduler modes', () => {
  const source = `
target "uma-cgra-base";
kernel "scheduler_modes" {
  cycle { at @0,0: SADD R1, R0, 1; }
  cycle { at @0,1: SADD R2, R0, 1; }
}
`;

  it('keeps deterministic output for same mode and input', () => {
    const first = compile(source, { schedulerMode: 'aggressive' });
    const second = compile(source, { schedulerMode: 'aggressive' });

    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    expect(first.artifacts.csv).toBe(second.artifacts.csv);
    expect(first.stats.schedulerMode).toBe('aggressive');
    expect(first.stats.loweredPasses).toContain('scheduler:aggressive');
  });

  it('uses safe mode by default and matches explicit safe behavior', () => {
    const implicit = compile(source);
    const explicit = compile(source, { schedulerMode: 'safe' });

    expect(implicit.success).toBe(true);
    expect(explicit.success).toBe(true);
    expect(implicit.stats.schedulerMode).toBe('safe');
    expect(explicit.stats.schedulerMode).toBe('safe');
    expect(implicit.artifacts.csv).toBe(explicit.artifacts.csv);
    expect(implicit.stats.loweredPasses).not.toContain('scheduler:balanced');
    expect(implicit.stats.loweredPasses).not.toContain('scheduler:aggressive');
  });

  it('keeps observable instruction workload while allowing cycle compaction', () => {
    const safe = compile(source, { schedulerMode: 'safe' });
    const balanced = compile(source, { schedulerMode: 'balanced' });
    const aggressive = compile(source, { schedulerMode: 'aggressive' });

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
