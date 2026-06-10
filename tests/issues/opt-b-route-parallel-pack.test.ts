import { describe, expect, it } from 'vitest';
import { compile } from '@castm/compiler-api';

function csvRows(csv: string): string[] {
  return csv.trim().split('\n').slice(1);
}

function bundleCount(csv: string): number {
  const rows = csvRows(csv);
  const bundles = new Set(rows.map((row) => row.split(',')[0]));
  return bundles.size;
}

describe('issues/OPT-B route overlap baseline', () => {
  it('reduces bundle count for disjoint single-hop routes under conservative packing', () => {
    const baseline = compile(`
target "uma-cgra-base";
kernel "opt_b_routes_baseline" {
  std::route(@0,0 -> @0,1, payload=R1, accum=R2);
  std::route(@2,2 -> @2,3, payload=R3, accum=R4);
}
`);
    const packed = compile(`
target "uma-cgra-base";
kernel "opt_b_routes_packed" {
  std::latency_hide(window=4, mode=conservative);
  std::route(@0,0 -> @0,1, payload=R1, accum=R2);
  std::route(@2,2 -> @2,3, payload=R3, accum=R4);
}
`);

    expect(baseline.success).toBe(true);
    expect(packed.success).toBe(true);

    const baseCsv = baseline.artifacts.csv ?? '';
    const packedCsv = packed.artifacts.csv ?? '';
    expect(bundleCount(baseCsv)).toBeGreaterThan(bundleCount(packedCsv));

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
  std::latency_hide(window=4, mode=conservative);
  std::route(@0,0 -> @0,1, payload=R1, accum=R2);
  std::route(@0,1 -> @0,2, payload=R3, accum=R4);
}
`);

    expect(packed.success).toBe(true);
    const packedBundles = bundleCount(packed.artifacts.csv ?? '');
    expect(packedBundles).toBeGreaterThanOrEqual(4);
  });
});
