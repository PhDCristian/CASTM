import { describe, expect, it } from 'vitest';
import { compile } from '@openedge/compiler-api';
import { ErrorCodes } from '@openedge/compiler-ir';

describe('issues/FEAT-8 range coordinate syntax', () => {
  it('expands horizontal ranges in a cycle statement', () => {
    const source = `
target "uma-cgra-base";
build {
  scheduler safe;
  prune_noop_cycles off;
}
kernel "feat8_horizontal" {
  cycle {
    @0,0..3: NOP;
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);
    const csv = result.artifacts.csv ?? '';
    expect(csv).toContain('0,0,0,NOP');
    expect(csv).toContain('0,0,1,NOP');
    expect(csv).toContain('0,0,2,NOP');
    expect(csv).toContain('0,0,3,NOP');
  });

  it('expands vertical ranges in a cycle statement', () => {
    const source = `
target "uma-cgra-base";
build {
  scheduler safe;
  prune_noop_cycles off;
}
kernel "feat8_vertical" {
  cycle {
    @0..3,2: NOP;
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

  it('expands rectangular ranges as cartesian product', () => {
    const source = `
target "uma-cgra-base";
kernel "feat8_rect" {
  cycle {
    @1..2,1..2: SADD R0, ZERO, ZERO;
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);
    const csv = result.artifacts.csv ?? '';
    expect(csv).toContain('0,1,1,SADD R0 ZERO ZERO');
    expect(csv).toContain('0,1,2,SADD R0 ZERO ZERO');
    expect(csv).toContain('0,2,1,SADD R0 ZERO ZERO');
    expect(csv).toContain('0,2,2,SADD R0 ZERO ZERO');
  });

  it('supports descending ranges with inclusive expansion', () => {
    const source = `
target "uma-cgra-base";
build {
  scheduler safe;
  prune_noop_cycles off;
}
kernel "feat8_descending" {
  cycle {
    @0,3..1: NOP;
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);
    const csv = result.artifacts.csv ?? '';
    expect(csv).toContain('0,0,3,NOP');
    expect(csv).toContain('0,0,2,NOP');
    expect(csv).toContain('0,0,1,NOP');
  });

  it('supports range syntax with loop-bound coordinates inside cycle scope', () => {
    const source = `
target "uma-cgra-base";
build {
  scheduler safe;
  prune_noop_cycles off;
}
kernel "feat8_loop_bound" {
  for r in range(2) {
    cycle {
      @r,0..1: NOP;
    }
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);
    const csv = result.artifacts.csv ?? '';
    expect(csv).toContain('0,0,0,NOP');
    expect(csv).toContain('0,0,1,NOP');
    expect(csv).toContain('1,1,0,NOP');
    expect(csv).toContain('1,1,1,NOP');
  });

  it('rejects unresolved range coordinates outside expansion context', () => {
    const source = `
target "uma-cgra-base";
build {
  scheduler safe;
  prune_noop_cycles off;
}
kernel "feat8_invalid_unresolved" {
  cycle {
    @r,0..1: NOP;
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(false);
    expect(result.diagnostics.some((d) => d.code === ErrorCodes.Semantic.UnresolvedCoordinateExpression)).toBe(true);
  });

  it('preserves unresolved non-range axis when paired with a range', () => {
    const source = `
target "uma-cgra-base";
build {
  scheduler safe;
  prune_noop_cycles off;
}
kernel "feat8_unresolved_axis" {
  cycle {
    @0..1,c: NOP;
  }
}
`;

    const result = compile(source);
    expect(result.success).toBe(false);
    expect(result.diagnostics.some((d) => d.code === ErrorCodes.Semantic.UnresolvedCoordinateExpression)).toBe(true);
  });
});
