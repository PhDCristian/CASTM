import { describe, expect, it } from 'vitest';
import { compile } from '@castm/compiler-api';

describe('FEAT-23 labeled control-flow statements', () => {
  it('attaches label to first emitted cycle of labeled for/if/while', () => {
    const source = `
target "uma-cgra-base";
kernel "labeled_control_flow" {
  loopLabel: for i in range(0, 1) {
    bundle { @0,0: NOP; }
  }

  ifLabel: if (R0 == 0) at @0,0 {
    bundle { @0,1: NOP; }
  } else {
    bundle { @0,2: NOP; }
  }

  whileLabel: while (R1 < 1) at @0,0 {
    bundle { @0,3: NOP; }
  }
}
`;

    const result = compile(source, { emitArtifacts: ['ast'] });
    expect(result.success).toBe(true);
    const cycles = result.artifacts.ast?.kernel?.cycles ?? [];
    expect(cycles.some((cycle) => cycle.label === 'loopLabel')).toBe(true);
    expect(cycles.some((cycle) => cycle.label === 'ifLabel')).toBe(true);
    expect(cycles.some((cycle) => cycle.label === 'whileLabel')).toBe(true);
  });

  it('keeps nested labels resolvable and deterministic', () => {
    const source = `
target "uma-cgra-base";
kernel "nested_labeled_control" {
  outerLoop: while (R0 < 2) at @0,0 {
    innerLoop: while (R1 < 2) at @0,1 {
      break outerLoop;
    }
    break;
  }
}
`;

    const result = compile(source, { emitArtifacts: ['ast'] });
    expect(result.success).toBe(true);
    const cycles = result.artifacts.ast?.kernel?.cycles ?? [];
    expect(cycles.some((cycle) => cycle.label === 'outerLoop')).toBe(true);
    expect(cycles.some((cycle) => cycle.label === 'innerLoop')).toBe(true);
  });

  it('emits an empty labeled cycle when labeled static for expands to zero iterations', () => {
    const source = `
target "uma-cgra-base";
kernel "labeled_empty_for" {
  emptyLoop: for i in range(0, 0) {
    bundle { @0,0: NOP; }
  }
}
`;

    const result = compile(source, { emitArtifacts: ['ast'] });
    expect(result.success).toBe(true);
    const cycle = result.artifacts.ast?.kernel?.cycles.find((entry) => entry.label === 'emptyLoop');
    expect(cycle).toBeDefined();
    expect(cycle?.statements).toHaveLength(0);
  });
});
