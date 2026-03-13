import { describe, expect, it } from 'vitest';
import {
  AstProgram,
  Diagnostic,
  ErrorCodes,
  spanAt
} from '@castm/compiler-ir';
import {
  collectDataRegions,
  parseData2dDirectiveValue,
  parseDataDirectiveValue
} from '../packages/compiler-api/src/compiler-driver/data-regions.js';
import {
  collectRuntimeArtifacts,
  createEmptyRuntimeArtifacts
} from '../packages/compiler-api/src/compiler-driver/runtime-artifacts.js';
import { resolveGrid } from '../packages/compiler-api/src/compiler-driver/grid-resolver.js';
import { runSemanticChecker } from '../packages/compiler-api/src/compiler-driver/semantic.js';

function makeAst(): AstProgram {
  const span = spanAt(1, 1, 1);
  return {
    target: { id: 'uma-cgra-base', raw: 'uma-cgra-base', span },
    targetProfileId: 'uma-cgra-base',
    span,
    kernel: {
      name: 'k',
      cycles: [{ index: 0, label: 'L0', statements: [], span }],
      directives: [],
      runtime: [],
      pragmas: [],
      span
    }
  };
}

describe('compiler-api compiler-driver modules', () => {
  it('parses data directives values', () => {
    expect(parseDataDirectiveValue('{ 1, 2, 3 }')).toEqual({ values: [1, 2, 3] });
    expect(parseDataDirectiveValue('100 { 7, 8 }')).toEqual({ explicitStart: 100, values: [7, 8] });

    expect(parseData2dDirectiveValue('[2][2] {1,2,3,4}')).toEqual({
      rows: 2,
      cols: 2,
      values: [1, 2, 3, 4]
    });
    expect(parseData2dDirectiveValue('[4]')).toEqual({
      rows: 2,
      cols: 2,
      values: [0, 0, 0, 0]
    });
  });

  it('collects memory regions and symbols from declarations', () => {
    const ast = makeAst();
    ast.kernel!.directives.push(
      { kind: 'data', name: 'A', value: '{ 10, 20, 30 }', span: spanAt(2, 1, 1) },
      { kind: 'data2d', name: 'M', value: '[2][2] { 1, 2, 3, 4 }', span: spanAt(3, 1, 1) }
    );

    const diagnostics: Diagnostic[] = [];
    const result = collectDataRegions(ast, diagnostics);

    expect(diagnostics).toHaveLength(0);
    expect(result.regions).toHaveLength(2);
    expect(result.symbolsByName.get('A')).toMatchObject({ start: 0, length: 3 });
    expect(result.symbolsByName.get('M')).toMatchObject({ start: 12, length: 4, rows: 2, cols: 2 });
  });

  it('reports duplicate symbols in declarations', () => {
    const ast = makeAst();
    ast.kernel!.directives.push(
      { kind: 'data', name: 'A', value: '{ 1 }', span: spanAt(2, 1, 1) },
      { kind: 'data2d', name: 'A', value: '[1][1] { 2 }', span: spanAt(3, 1, 1) }
    );

    const diagnostics: Diagnostic[] = [];
    const result = collectDataRegions(ast, diagnostics);

    expect(result.regions).toHaveLength(1);
    expect(diagnostics.some((d) => d.code === ErrorCodes.Parse.InvalidSyntax)).toBe(true);
  });

  it('collects runtime artifacts from directives and labels', () => {
    const ast = makeAst();
    ast.kernel!.directives.push(
      { kind: 'const', name: 'MASK', value: '0xFFFF', span: spanAt(2, 1, 1) },
      { kind: 'alias', name: 'acc', value: 'R1', span: spanAt(3, 1, 1) }
    );
    ast.kernel!.runtime!.push(
      { kind: 'io_load', addresses: ['100', '104'], raw: 'io.load(100, 104)', span: spanAt(4, 1, 1) },
      { kind: 'io_store', addresses: ['200'], raw: 'io.store(200)', span: spanAt(5, 1, 1) },
      { kind: 'limit', value: '12', raw: 'limit(12)', span: spanAt(6, 1, 1) },
      {
        kind: 'assert',
        at: { row: '0', col: '0' },
        reg: 'R1',
        equals: '42',
        cycle: '0',
        raw: 'assert(at=@0,0, reg=R1, equals=42, cycle=0)',
        span: spanAt(7, 1, 1)
      }
    );

    const diagnostics: Diagnostic[] = [];
    const runtime = collectRuntimeArtifacts(ast, [], diagnostics);

    expect(diagnostics).toHaveLength(0);
    expect(runtime.ioConfig.loadAddrs).toEqual([100, 104]);
    expect(runtime.ioConfig.storeAddrs).toEqual([200]);
    expect(runtime.cycleLimit).toBe(12);
    expect(runtime.assertions).toHaveLength(1);
    expect(runtime.symbols.constants.MASK).toBe('0xFFFF');
    expect(runtime.symbols.aliases.acc).toBe('R1');
    expect(runtime.symbols.labels.L0).toBe(0);
  });

  it('resolves grid from target/build and validates dimensions', () => {
    const ast = makeAst();
    const diagnostics: Diagnostic[] = [];

    const resolved = resolveGrid(ast, diagnostics);
    expect(resolved).not.toBeNull();
    expect(resolved?.targetProfileId).toBe('uma-cgra-base');
    expect(resolved?.grid.rows).toBeGreaterThan(0);

    ast.build = {
      grid: { rows: 0, cols: 4, topology: 'torus' },
      span: spanAt(1, 1, 1)
    };
    const badDiagnostics: Diagnostic[] = [];
    const bad = resolveGrid(ast, badDiagnostics);
    expect(bad).toBeNull();
    expect(badDiagnostics.some((d) => d.code === ErrorCodes.Semantic.InvalidGridSpec)).toBe(true);
  });

  it('creates empty runtime artifacts defaults', () => {
    const empty = createEmptyRuntimeArtifacts();
    expect(empty.ioConfig).toEqual({ loadAddrs: [], storeAddrs: [] });
    expect(empty.assertions).toEqual([]);
    expect(empty.symbols.constants).toEqual({});
  });

  it('semantic checker reports duplicate declaration symbols', () => {
    const ast = makeAst();
    ast.kernel!.directives.push(
      { kind: 'const', name: 'A', value: '1', span: spanAt(2, 1, 1) },
      { kind: 'alias', name: 'A', value: 'R1', span: spanAt(3, 1, 1) }
    );

    const diagnostics: Diagnostic[] = [];
    const result = runSemanticChecker(ast, diagnostics);
    expect(result.loweredPasses).toEqual(['semantic-checker']);
    expect(diagnostics.some((d) => d.code === ErrorCodes.Semantic.UnsupportedOperation)).toBe(true);
  });
});
