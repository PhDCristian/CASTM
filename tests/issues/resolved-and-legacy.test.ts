import { describe, expect, it } from 'vitest';
import { compile } from '@castm/compiler-api';
import { ErrorCodes } from '@castm/compiler-ir';

describe('issues resolved/non-regression and canonical legacy rejection', () => {
  it('keeps BUG-6 fixed: function parameters are valid operands in expression syntax', () => {
    const source = `
target "uma-cgra-base";
function extract(dst, src) {
  bundle { @0,0: dst = src >> 16; }
}
kernel "bug6_regression" {
  extract(R1, R0);
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);
    expect(result.artifacts.csv ?? '').toMatch(/\n\d+,0,0,SRT R1 R0 16(?:\n|$)/);
  });

  it('keeps canonical spatial forms and for-in-cycle behavior', () => {
    const source = `
target "uma-cgra-base";
build {
  optimize O0;
  prune_noop_cycles off;
}
kernel "spatial_regression" {
  bundle {
    at all: NOP;
  }
  bundle {
    at row 1: NOP;
  }
  bundle {
    at col 2: NOP;
  }
  bundle {
    for i in range(4) {
      @0,i: NOP;
    }
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);
    expect(result.artifacts.csv).toContain('0,0,0,NOP');
    expect(result.artifacts.csv).toContain('1,1,3,NOP');
    expect(result.artifacts.csv).toContain('2,3,2,NOP');
    expect(result.artifacts.csv).toContain('3,0,3,NOP');
  });

  it('rejects legacy syntax explicitly in canonical mode', () => {
    const source = `
target "uma-cgra-base";
kernel "legacy_reject" {
  #pragma route @0,1 -> @0,0 payload(R3) accum(R1)
  bundle {
    row 0: R3 = R2 | R1 = R0;
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(false);
    expect(result.diagnostics.some((d) => d.code === ErrorCodes.Parse.InvalidSyntax)).toBe(true);
    expect(result.diagnostics.some((d) => d.message.includes('Unrecognized kernel statement'))).toBe(true);
  });

  it('rejects legacy auto_cycle pragma workflow explicitly', () => {
    const source = `
target "uma-cgra-base";
kernel "legacy_auto_cycle_reject" {
  #pragma auto_cycle
  @0,0: NOP;
  #pragma end_auto_cycle
}
`;

    const result = compile(source);
    expect(result.success).toBe(false);
    expect(result.diagnostics.some((d) => d.code === ErrorCodes.Parse.InvalidSyntax)).toBe(true);
    expect(result.diagnostics.some((d) => d.message.includes('#pragma auto_cycle'))).toBe(true);
  });

  it('rejects legacy parallel pragmas explicitly', () => {
    const source = `
target "uma-cgra-base";
kernel "legacy_parallel_reject" {
  #pragma parallel collapse(2)
  for i in range(0, 4) {
    bundle { @0,i: NOP; }
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(false);
    expect(result.diagnostics.some((d) => d.code === ErrorCodes.Parse.InvalidSyntax)).toBe(true);
    expect(result.diagnostics.some((d) => d.message.includes('#pragma parallel'))).toBe(true);
  });
});
