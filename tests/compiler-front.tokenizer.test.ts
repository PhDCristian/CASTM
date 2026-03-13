import { describe, expect, it } from 'vitest';
import { tokenizeSource } from '@castm/compiler-front';

describe('compiler-front tokenizer canonical contracts', () => {
  it('classifies canonical declarations and control-flow as keywords', () => {
    const source = `
target "uma-cgra-base";
let A = { 1, 2, 3 };
kernel "k" {
  for R0 in range(0, 4) at @0,0 runtime {
    bundle { at row 0: NOP; }
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
  accumulate(pattern=row, products=R2, accum=R3, out=ROUT);
  mulacc_chain(src=R0, coeff=R1, acc=R3, out=R2, target=row(0), width=16, dir=right);
  carry_chain(src=R0, carry=R3, store=L, limbs=4, width=16, row=0);
  conditional_sub(value=R0, sub=R1, dest=R2, target=row(1));
  pipeline(step0(), step1(R0));
  collect(from=row(1), to=row(0), via=RCB, local=R2, into=R3, combine=add);
  normalize(reg=R3, carry=R1, width=16, lane=0);
  extract_bytes(src=R0, dest=R1, axis=col);
  triangle(shape=upper, inclusive=true, op=SMUL, dest=R2, srcA=R0, srcB=R1);
}
`;
    const tokens = tokenizeSource(source);
    const tokenByValue = new Map(tokens.map((t) => [t.value, t.type]));

    expect(tokenByValue.get('route')).toBe('keyword');
    expect(tokenByValue.get('reduce')).toBe('keyword');
    expect(tokenByValue.get('guard')).toBe('keyword');
    expect(tokenByValue.get('accumulate')).toBe('keyword');
    expect(tokenByValue.get('mulacc_chain')).toBe('keyword');
    expect(tokenByValue.get('carry_chain')).toBe('keyword');
    expect(tokenByValue.get('conditional_sub')).toBe('keyword');
    expect(tokenByValue.get('pipeline')).toBe('keyword');
    expect(tokenByValue.get('collect')).toBe('keyword');
    expect(tokenByValue.get('normalize')).toBe('keyword');
    expect(tokenByValue.get('extract_bytes')).toBe('keyword');
    expect(tokenByValue.get('triangle')).toBe('keyword');
  });
});
