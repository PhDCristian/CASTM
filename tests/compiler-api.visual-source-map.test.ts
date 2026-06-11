import { describe, expect, it } from 'vitest';
import {
  applyVisualPatch,
  canonicalizeBundleMatrix,
  compileWithSourceMap,
  hashCastmSource
} from '@castm/compiler-api';
import type { CastmBundleMatrix } from '@castm/compiler-api';

const SIMPLE_SOURCE = `target base;
kernel "T" {
  bundle {
    @0,0: SADD R1, R0, R0;
  }
}`;

function matrix(cells: CastmBundleMatrix['cells']): CastmBundleMatrix {
  return {
    bundle: 0,
    grid: { rows: 4, cols: 4, topology: 'torus', wrapPolicy: 'wrap' },
    cells
  };
}

describe('compiler-api visual source maps', () => {
  it('emits direct slot source metadata for simulator matrix CSV cells', () => {
    const result = compileWithSourceMap(SIMPLE_SOURCE);

    expect(result.success).toBe(true);
    const entry = result.emitResult?.sourceMap?.entries.find((candidate) => (
      candidate.bundle === 0 && candidate.row === 0 && candidate.col === 0
    ));

    expect(entry).toBeDefined();
    expect(entry?.instruction).toBe('SADD R1, R0, R0');
    expect(entry?.source.originKind).toBe('direct');
    expect(entry?.source.editPolicy).toBe('direct-editable');
    expect(entry?.source.originSpan.startLine).toBe(4);
    expect(entry?.source.instructionSpan.startLine).toBe(4);
    expect(entry?.emit).toMatchObject({
      format: 'sim-matrix-csv',
      line: 2,
      column: 1
    });
  });

  it('marks at all expansion as a canonical region edit', () => {
    const result = compileWithSourceMap(`target base;
kernel "T" {
  bundle {
    at all: SADD R1, R0, R0;
  }
}`);

    expect(result.success).toBe(true);
    const entries = result.emitResult?.sourceMap?.entries ?? [];
    expect(entries).toHaveLength(16);
    expect(new Set(entries.map((entry) => entry.source.originKind))).toEqual(new Set(['at-all-expanded']));
    expect(new Set(entries.map((entry) => entry.source.editPolicy))).toEqual(new Set(['canonicalize-region']));
    expect(entries.every((entry) => entry.source.originSpan.startLine === 4)).toBe(true);
  });

  it('marks coordinate ranges as canonical region edits', () => {
    const result = compileWithSourceMap(`target base;
kernel "T" {
  bundle {
    at @0,1..3: SADD R1, R0, R0;
  }
}`);

    expect(result.success).toBe(true);
    const entries = result.emitResult?.sourceMap?.entries ?? [];
    expect(entries.map((entry) => [entry.row, entry.col])).toEqual([[0, 1], [0, 2], [0, 3]]);
    expect(new Set(entries.map((entry) => entry.source.originKind))).toEqual(new Set(['range-expanded']));
    expect(new Set(entries.map((entry) => entry.source.editPolicy))).toEqual(new Set(['canonicalize-region']));
  });
});

describe('compiler-api visual patch canonicalization', () => {
  it('canonicalizes full-grid identical cells as at all', () => {
    const cells: CastmBundleMatrix['cells'] = [];
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        cells.push({ row, col, instruction: 'SADD R1, R0, R0' });
      }
    }

    expect(canonicalizeBundleMatrix(matrix(cells))).toBe(`bundle {
  at all: SADD R1, R0, R0;
}`);
  });

  it('canonicalizes contiguous row ranges', () => {
    expect(canonicalizeBundleMatrix(matrix([
      { row: 0, col: 1, instruction: 'SADD R1, R0, R0' },
      { row: 0, col: 2, instruction: 'SADD R1, R0, R0' },
      { row: 0, col: 3, instruction: 'SADD R1, R0, R0' }
    ]))).toBe(`bundle {
  at @0,1..3: SADD R1, R0, R0;
}`);
  });

  it('applies a visual replace-slot patch as a verified CASTM source update', () => {
    const result = applyVisualPatch(SIMPLE_SOURCE, {
      kind: 'replace-slot',
      bundle: 0,
      row: 0,
      col: 1,
      instruction: 'SADD R2, R0, R0'
    }, {
      expectedSourceHash: hashCastmSource(SIMPLE_SOURCE)
    });

    expect(result.status).toBe('applied');
    if (result.status !== 'applied') return;

    expect(result.updatedArtifacts.success).toBe(true);
    expect(result.updatedSource).toContain('@0,0: SADD R1, R0, R0;');
    expect(result.updatedSource).toContain('@0,1: SADD R2, R0, R0;');
    expect(result.updatedSource).toContain('SADD R1, R0, R0');
    expect(result.updatedSource).toContain('SADD R2, R0, R0');
  });

  it('materializes a single-bundle function call when a visual move breaks at all', () => {
    const source = `target base;
function load_all(reg, addr) {
  bundle { at all: LWI reg, addr; }
}

kernel "T" {
  mainEntry: load_all(R0, 0);
  bundle {
    @1,1: SADD R2, R0, R0;
  }
}`;

    const result = applyVisualPatch(source, {
      kind: 'move-slot',
      from: { bundle: 0, row: 0, col: 0 },
      to: { bundle: 1, row: 0, col: 0 }
    }, {
      expectedSourceHash: hashCastmSource(source)
    });

    expect(result.status).toBe('applied');
    if (result.status !== 'applied') return;

    const lines = result.updatedSource.split('\n');
    expect(result.updatedArtifacts.success).toBe(true);
    expect(result.updatedSource).not.toContain('mainEntry: load_all(R0, 0);');
    expect(lines).toContain('  mainEntry: bundle {');
    expect(lines).toContain('      at @0,1..3: LWI R0, 0;');
    expect(result.updatedSource).toContain('@0,0: LWI R0, 0;');
    expect(result.updatedSource).toContain('@1,1: SADD R2, R0, R0;');
    expect(result.changedLineRanges.length).toBe(2);
  });

  it('does not clear unrelated target-bundle cells during a cross-bundle move', () => {
    const source = `target base;
kernel "T" {
  bundle {
    @2,2: LWI R0, 0;
  }
  bundle {
    @2,2: SADD R2, R0, R0;
  }
}`;

    const result = applyVisualPatch(source, {
      kind: 'move-slot',
      from: { bundle: 0, row: 2, col: 2 },
      to: { bundle: 1, row: 0, col: 0 }
    });

    expect(result.status).toBe('applied');
    if (result.status !== 'applied') return;

    expect(result.updatedSource).toContain('@0,0: LWI R0, 0;');
    expect(result.updatedSource).toContain('@2,2: SADD R2, R0, R0;');
  });

  it('moves direct symbolic CASTM instructions without lowering labels or assignment sugar', () => {
    const source = `target base;
function load_all(reg, addr) {
  bundle { at all: LWI reg, addr; }
}

kernel "Sbox" {
    mainEntry: load_all(R0, 0);
    bundle {
        @0,1: goto subrC;
        @3,0: R3 = ZERO + ret1;
    }
    ret1: bundle {
        @0,0: EXIT;
    }
    subrC: bundle {
        @3,0: goto ret1;
    }
}`;

    const result = applyVisualPatch(source, {
      kind: 'move-slot',
      from: { bundle: 1, row: 0, col: 1 },
      to: { bundle: 1, row: 0, col: 2 }
    });

    expect(result.status).toBe('applied');
    if (result.status !== 'applied') return;

    expect(result.updatedArtifacts.success).toBe(true);
    expect(result.updatedSource).toContain('@0,2: goto subrC;');
    expect(result.updatedSource).toContain('@3,0: R3 = ZERO + ret1;');
    expect(result.updatedSource).not.toContain('JUMP ZERO');
    expect(result.updatedSource).not.toContain('SADD R3, ZERO');
  });

  it('repairs kernel-scope indentation when rematerializing an already flush-left bundle', () => {
    const source = `target base;
kernel "T" {

    // already materialized by a previous visual edit
mainEntry: bundle {
  at all: LWI R0, 0;
}
}`;

    const result = applyVisualPatch(source, {
      kind: 'clear-slot',
      bundle: 0,
      row: 0,
      col: 0
    });

    expect(result.status).toBe('applied');
    if (result.status !== 'applied') return;

    const lines = result.updatedSource.split('\n');
    expect(lines).toContain('    mainEntry: bundle {');
    expect(lines).toContain('        at @0,1..3: LWI R0, 0;');
  });
});
