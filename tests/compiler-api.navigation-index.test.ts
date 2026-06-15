import { describe, expect, it } from 'vitest';
import { buildNavigationIndex, compileWithSourceMap } from '@castm/compiler-api';

const SOURCE = `target base;
function load_all(reg, addr) {
  bundle { at all: LWI reg, addr; }
}

kernel "Sbox" {
  mainEntry: load_all(R0, 0);
  bundle {
    @0,1: goto subrC;
    @3,0: R3 = ZERO + ret1;
  }
  ret1: bundle { @0,0: EXIT; }
  subrC: bundle { @3,0: goto ret1; }
}`;

describe('compiler-api navigation index', () => {
  it('maps function calls to emitted cells without simulator parsing', () => {
    const artifacts = compileWithSourceMap(SOURCE);
    const index = buildNavigationIndex(artifacts);

    const loadAll = index.symbols.find((symbol) => (
      symbol.kind === 'function' && symbol.name === 'load_all'
    ));

    expect(loadAll).toBeDefined();
    expect(loadAll?.definitionSpan.startLine).toBe(2);
    expect(loadAll?.referenceSpans.map((span) => span.startLine)).toContain(7);
    expect(loadAll?.emittedCells).toHaveLength(16);
    expect(new Set(loadAll?.emittedCells?.map((cell) => cell.bundle))).toEqual(new Set([0]));
  });

  it('maps label definitions and references to source spans and emitted cells', () => {
    const artifacts = compileWithSourceMap(SOURCE);
    const index = buildNavigationIndex(artifacts);

    const subrC = index.symbols.find((symbol) => (
      symbol.kind === 'label' && symbol.name === 'subrC'
    ));
    const ret1 = index.symbols.find((symbol) => (
      symbol.kind === 'label' && symbol.name === 'ret1'
    ));

    expect(subrC).toBeDefined();
    expect(subrC?.definitionSpan.startLine).toBe(13);
    expect(subrC?.referenceSpans.map((span) => span.startLine)).toContain(9);
    expect(subrC?.emittedCells?.some((cell) => cell.bundle === 3 && cell.row === 3 && cell.col === 0)).toBe(true);

    expect(ret1).toBeDefined();
    expect(ret1?.definitionSpan.startLine).toBe(12);
    expect(ret1?.referenceSpans.map((span) => span.startLine).sort()).toEqual([10, 13]);
    expect(ret1?.emittedCells?.some((cell) => cell.bundle === 2 && cell.row === 0 && cell.col === 0)).toBe(true);
  });

  it('keeps source-map cell groups addressable by origin spans', () => {
    const artifacts = compileWithSourceMap(SOURCE);
    const index = buildNavigationIndex(artifacts);

    const callGroup = index.sourceRanges.find((range) => range.span.startLine === 7);

    expect(callGroup).toBeDefined();
    expect(callGroup?.target.cells).toHaveLength(16);
    expect(callGroup?.target.cells.every((cell) => cell.bundle === 0)).toBe(true);
  });

  it('keeps label navigation global because duplicate labels are compiler errors', () => {
    const artifacts = compileWithSourceMap(`target base;
kernel "duplicate_labels" {
  L0: bundle { @0,0: NOP; }
  L0: bundle { @0,0: EXIT; }
}`);

    expect(artifacts.success).toBe(false);
    expect(artifacts.diagnostics.some((diagnostic) => (
      diagnostic.severity === 'error' && diagnostic.message.includes("Duplicate bundle label 'L0'")
    ))).toBe(true);
  });
});
