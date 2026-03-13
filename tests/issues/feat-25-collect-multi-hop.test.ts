import { describe, expect, it } from 'vitest';
import { compile } from '@castm/compiler-api';
import { ErrorCodes } from '@castm/compiler-ir';

describe('FEAT-25 collect multi-hop path', () => {
  it('keeps single_hop default and rejects distance > 1 without path=multi_hop', () => {
    const result = compile(`
target "uma-cgra-base";
kernel "collect_single_hop_reject" {
  std::collect(from=row(0), to=row(2), via=RCT, local=R2, into=R3, combine=add);
}
`);

    expect(result.success).toBe(false);
    expect(result.diagnostics.some((d) => d.code === ErrorCodes.Semantic.InvalidCollectPath)).toBe(true);
  });

  it('supports deterministic multi-hop collect on rows', () => {
    const result = compile(`
target "uma-cgra-base";
kernel "collect_multi_hop_row" {
  std::collect(from=row(0), to=row(2), via=RCT, local=R2, into=R3, combine=copy, path=multi_hop, max_hops=2);
}
`, { emitArtifacts: ['ast'] });

    expect(result.success).toBe(true);
    const cycles = result.artifacts.ast?.kernel?.cycles ?? [];
    const copyCycles = cycles.filter((cycle) =>
      cycle.statements.some((stmt) => 'instruction' in stmt && stmt.instruction.text.startsWith('SADD R3, RCT, ZERO'))
    );
    expect(copyCycles.length).toBeGreaterThanOrEqual(2);
    const firstRows = copyCycles
      .map((cycle) => cycle.statements.find((stmt) => 'instruction' in stmt))
      .filter((stmt): stmt is { row: number } => Boolean(stmt && 'row' in stmt))
      .map((stmt) => stmt.row);
    expect(firstRows.slice(0, 2)).toEqual([1, 2]);
  });

  it('rejects multi-hop when max_hops is lower than required distance', () => {
    const result = compile(`
target "uma-cgra-base";
kernel "collect_multi_hop_max_hops_reject" {
  std::collect(from=col(0), to=col(3), via=RCL, local=R2, into=R3, combine=copy, path=multi_hop, max_hops=2);
}
`);

    expect(result.success).toBe(false);
    expect(result.diagnostics.some((d) => d.code === ErrorCodes.Semantic.InvalidCollectPath)).toBe(true);
  });

  it('rejects multi-hop via mismatch with E3013', () => {
    const result = compile(`
target "uma-cgra-base";
kernel "collect_multi_hop_via_mismatch" {
  std::collect(from=row(0), to=row(2), via=RCB, local=R2, into=R3, combine=copy, path=multi_hop, max_hops=2);
}
`);

    expect(result.success).toBe(false);
    expect(result.diagnostics.some((d) => d.code === ErrorCodes.Semantic.InvalidCollectPath)).toBe(true);
  });

  it('keeps single-hop behavior backward compatible', () => {
    const result = compile(`
target "uma-cgra-base";
kernel "collect_single_hop_ok" {
  std::collect(from=row(1), to=row(0), via=RCB, local=R2, into=R3, combine=add);
}
`);

    expect(result.success).toBe(true);
    expect(result.diagnostics).toHaveLength(0);
  });
});
