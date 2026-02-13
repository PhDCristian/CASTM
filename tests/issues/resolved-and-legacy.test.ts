import { describe, expect, it } from 'vitest';
import { compile } from '@openedge/compiler-api';
import { ErrorCodes } from '@openedge/compiler-ir';

describe('issues resolved/non-regression and canonical legacy rejection', () => {
  it('keeps BUG-6 fixed: function parameters are valid operands in expression syntax', () => {
    const source = `
target "uma-cgra-base";
function extract(dst, src) {
  cycle { @0,0: dst = src >> IMM(16); }
}
kernel "bug6_regression" {
  extract(R1, R0);
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);
    expect(result.artifacts.csv).toContain('0,0,0,SRT R1 R0 IMM(16)');
  });

  it('keeps canonical spatial forms and for-in-cycle behavior', () => {
    const source = `
target "uma-cgra-base";
kernel "spatial_regression" {
  cycle {
    at all: NOP;
  }
  cycle {
    at row 1: NOP;
  }
  cycle {
    at col 2: NOP;
  }
  cycle {
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
  cycle {
    row 0: R3 = R2 | R1 = R0;
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(false);
    expect(result.diagnostics.some((d) => d.code === ErrorCodes.Parse.InvalidSyntax)).toBe(true);
    expect(result.diagnostics.some((d) => d.message.includes('Unrecognized kernel statement'))).toBe(true);
  });
});
