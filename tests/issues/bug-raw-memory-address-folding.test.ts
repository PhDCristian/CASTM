import { describe, expect, it } from 'vitest';
import { compile } from '@castm/compiler-api';

describe('issues/raw-memory-address-folding', () => {
  it('folds raw address arithmetic inside memory sugar load/store to integer addresses', () => {
    const source = `
target "uma-cgra-base";
let A = { 10, 20, 30, 40 };
let B @100 = { 0, 0, 0, 0 };

kernel "mem_sugar" {
  bundle {
    at @0,0: R0 = A[1];
    at @0,1: B[2] = R0;
    at @0,2: [360 + 2*4] = R1;
    at @0,3: R2 = [360 + 2*4];
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);
    const csv = result.artifacts.csv ?? '';
    expect(csv).toContain('0,0,0,LWI R0 4');
    expect(csv).toContain('0,0,1,SWI R0 108');
    expect(csv).toContain('0,0,2,SWI R1 368');
    expect(csv).toContain('0,0,3,LWI R2 368');
  });
});
