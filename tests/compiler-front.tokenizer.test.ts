import { describe, expect, it } from 'vitest';
import { tokenizeSource } from '@openedge/compiler-front';

describe('compiler-front tokenizer canonical contracts', () => {
  it('classifies canonical declarations and control-flow as keywords', () => {
    const source = `
target "uma-cgra-base";
let A = { 1, 2, 3 };
kernel "k" {
  for R0 in range(0, 4) at @0,0 runtime {
    cycle { at row 0: NOP; }
  }
}
`;
    const tokens = tokenizeSource(source);
    const keywordValues = tokens.filter((t) => t.type === 'keyword').map((t) => t.value.toLowerCase());

    expect(keywordValues).toContain('let');
    expect(keywordValues).toContain('for');
    expect(keywordValues).toContain('range');
    expect(keywordValues).toContain('at');
    expect(keywordValues).toContain('runtime');
    expect(keywordValues).toContain('row');
  });

  it('classifies advanced statements as keywords', () => {
    const source = `
target "uma-cgra-base";
kernel "k" {
  route(@0,1 -> @0,0, payload=R3, accum=R1);
  reduce(op=add, dest=R1, src=R0, axis=row);
  guard(cond=col>=row, op=SMUL, dest=R2, srcA=R0, srcB=R1);
  triangle(shape=upper, inclusive=true, op=SMUL, dest=R2, srcA=R0, srcB=R1);
}
`;
    const tokens = tokenizeSource(source);
    const tokenByValue = new Map(tokens.map((t) => [t.value, t.type]));

    expect(tokenByValue.get('route')).toBe('keyword');
    expect(tokenByValue.get('reduce')).toBe('keyword');
    expect(tokenByValue.get('guard')).toBe('keyword');
    expect(tokenByValue.get('triangle')).toBe('keyword');
  });
});
