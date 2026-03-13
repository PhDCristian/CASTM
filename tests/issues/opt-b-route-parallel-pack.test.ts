import { describe, expect, it } from 'vitest';
import { compile } from '@castm/compiler-api';

function csvRows(csv: string): string[] {
  return csv.trim().split('\n').slice(1);
}

function cycleCount(csv: string): number {
  const rows = csvRows(csv);
  const cycles = new Set(rows.map((row) => row.split(',')[0]));
  return cycles.size;
}

describe('issues/OPT-B route overlap baseline', () => {
  it('reduces cycle count for disjoint single-hop routes under conservative packing', () => {
    const baseline = compile(`
target "uma-cgra-base";
kernel "opt_b_routes_baseline" {
  route(@0,0 -> @0,1, payload=R1, accum=R2);
  route(@2,2 -> @2,3, payload=R3, accum=R4);
}
`);
    const packed = compile(`
target "uma-cgra-base";
kernel "opt_b_routes_packed" {
  latency_hide(window=4, mode=conservative);
  route(@0,0 -> @0,1, payload=R1, accum=R2);
  route(@2,2 -> @2,3, payload=R3, accum=R4);
}
`);

    expect(baseline.success).toBe(true);
    expect(packed.success).toBe(true);

    const baseCsv = baseline.artifacts.csv ?? '';
    const packedCsv = packed.artifacts.csv ?? '';
    expect(cycleCount(baseCsv)).toBeGreaterThan(cycleCount(packedCsv));

    const rows = csvRows(packedCsv);
    expect(rows.some((row) => row.endsWith(',SADD ROUT R1 ZERO'))).toBe(true);
    expect(rows.some((row) => row.endsWith(',SADD ROUT R3 ZERO'))).toBe(true);
    expect(rows.some((row) => row.endsWith(',SADD R2 R2 RCL'))).toBe(true);
    expect(rows.some((row) => row.endsWith(',SADD R4 R4 RCL'))).toBe(true);
  });

  it('does not merge when routes share occupied PEs in adjacent steps', () => {
    const packed = compile(`
target "uma-cgra-base";
kernel "opt_b_routes_conflict" {
  latency_hide(window=4, mode=conservative);
  route(@0,0 -> @0,1, payload=R1, accum=R2);
  route(@0,1 -> @0,2, payload=R3, accum=R4);
}
`);

    expect(packed.success).toBe(true);
    const packedCycles = cycleCount(packed.artifacts.csv ?? '');
    expect(packedCycles).toBeGreaterThanOrEqual(4);
  });
});
