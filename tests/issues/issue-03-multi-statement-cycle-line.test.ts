import { describe, expect, it } from 'vitest';
import { compile } from '@castm/compiler-api';

describe('issues/Issue-3 multi-statement cycle lines', () => {
  it('parses and lowers two @placements in one line inside a cycle block', () => {
    const source = `
target "uma-cgra-base";
kernel "issue3_multi_statement" {
  bundle {
    @0,0: R1 = R0; @0,1: R2 = R0;
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);
    expect(result.artifacts.csv).toContain('0,0,0,SADD R1 R0 ZERO');
    expect(result.artifacts.csv).toContain('0,0,1,SADD R2 R0 ZERO');
  });

  it('supports expression desugar on both statements in the same block line', () => {
    const source = `
target "uma-cgra-base";
kernel "issue3_multi_statement_expr" {
  bundle {
    @0,0: R3 = R2 >> 16; @0,1: R4 = R2 & 255;
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);
    expect(result.artifacts.csv).toContain('0,0,0,SRT R3 R2 16');
    expect(result.artifacts.csv).toContain('0,0,1,LAND R4 R2 255');
  });
});
