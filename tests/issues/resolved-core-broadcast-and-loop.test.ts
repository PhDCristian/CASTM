import { describe, expect, it } from 'vitest';
import { compile } from '@castm/compiler-api';

describe('issues resolved core regressions (broadcast + loop vars)', () => {
  it('keeps Issue-1 fixed: at all works inside function expansion', () => {
    const source = `
target "uma-cgra-base";
function fill_all() {
  bundle {
    at all: SADD R0, ZERO, 99;
  }
}
kernel "issue1_all_in_fn" {
  fill_all();
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);

    const csv = result.artifacts.csv ?? '';
    expect(csv).toMatch(/\n\d+,0,0,SADD R0 ZERO 99(?:\n|$)/);
    expect(csv).toMatch(/\n\d+,3,3,SADD R0 ZERO 99(?:\n|$)/);
  });

  it('keeps Issue-5 fixed: at row single instruction broadcasts across columns', () => {
    const source = `
target "uma-cgra-base";
kernel "issue5_row_broadcast" {
  bundle {
    at row 0: LWI R0, 720;
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);

    const csv = result.artifacts.csv ?? '';
    expect(csv).toContain('0,0,0,LWI R0 720');
    expect(csv).toContain('0,0,1,LWI R0 720');
    expect(csv).toContain('0,0,2,LWI R0 720');
    expect(csv).toContain('0,0,3,LWI R0 720');
  });

  it('keeps Issue-9 fixed: at col syntax broadcasts across rows', () => {
    const source = `
target "uma-cgra-base";
build {
  optimize O0;
  prune_noop_cycles off;
}
kernel "issue9_col_broadcast" {
  bundle {
    at col 2: NOP;
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);

    const csv = result.artifacts.csv ?? '';
    expect(csv).toContain('0,0,2,NOP');
    expect(csv).toContain('0,1,2,NOP');
    expect(csv).toContain('0,2,2,NOP');
    expect(csv).toContain('0,3,2,NOP');
  });

  it('keeps Issue-10 fixed: loop variable named col is accepted', () => {
    const source = `
target "uma-cgra-base";
kernel "issue10_col_var" {
  for col in range(1, 3) {
    bundle {
      @0,0: SADD R1, ZERO, col;
    }
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);

    const csv = result.artifacts.csv ?? '';
    expect(csv).toContain('0,0,0,SADD R1 ZERO 1');
    expect(csv).toContain('1,0,0,SADD R1 ZERO 2');
  });

  it('keeps BUG-1 fixed: mixed row/at styles in same cycle do not corrupt output', () => {
    const source = `
target "uma-cgra-base";
kernel "bug1_mixed_broadcast" {
  bundle {
    at row 0: SADD R0, ZERO, 1;
    @1,1: SADD R1, ZERO, 2;
    @2,3: SADD R2, ZERO, 3;
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);

    const csv = result.artifacts.csv ?? '';
    expect(csv).toContain('0,0,0,SADD R0 ZERO 1');
    expect(csv).toContain('0,1,1,SADD R1 ZERO 2');
    expect(csv).toContain('0,2,3,SADD R2 ZERO 3');
  });
});
