import { describe, expect, it } from 'vitest';
import { compile } from '@castm/compiler-api';

describe('FEAT-23 labeled control-flow statements', () => {
  it('attaches label to first emitted bundle of labeled for/if/while', () => {
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
    const bundles = result.artifacts.ast?.kernel?.bundles ?? [];
    expect(bundles.some((bundle) => bundle.label === 'loopLabel')).toBe(true);
    expect(bundles.some((bundle) => bundle.label === 'ifLabel')).toBe(true);
    expect(bundles.some((bundle) => bundle.label === 'whileLabel')).toBe(true);
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
    const bundles = result.artifacts.ast?.kernel?.bundles ?? [];
    expect(bundles.some((bundle) => bundle.label === 'outerLoop')).toBe(true);
    expect(bundles.some((bundle) => bundle.label === 'innerLoop')).toBe(true);
  });

  it('emits an empty labeled bundle when labeled static for expands to zero iterations', () => {
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
    const bundle = result.artifacts.ast?.kernel?.bundles.find((entry) => entry.label === 'emptyLoop');
    expect(bundle).toBeDefined();
    expect(bundle?.statements).toHaveLength(0);
  });
});
