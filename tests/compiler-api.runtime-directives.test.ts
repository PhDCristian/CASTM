import { describe, expect, it } from 'vitest';
import {
  AstProgram,
  ErrorCodes,
  spanAt
} from '@castm/compiler-ir';
import { parseAssertionDirectiveValue } from '../packages/compiler-api/src/compiler-driver/assertions.js';
import { collectDirectiveArtifacts } from '../packages/compiler-api/src/compiler-driver/runtime-artifacts/directives.js';
import { createEmptySymbolCollections } from '../packages/compiler-api/src/compiler-driver/runtime-artifacts/symbols.js';

function makeAst(): AstProgram {
  const span = spanAt(1, 1, 1);
  return {
    target: { id: 'uma-cgra-base', raw: 'uma-cgra-base', span },
    targetProfileId: 'uma-cgra-base',
    span,
    kernel: {
      name: 'k',
      config: undefined,
      pragmas: [],
      directives: [],
      runtime: [],
      cycles: [
        { index: 0, statements: [], span: spanAt(3, 1, 1) },
        { index: 4, statements: [], span: spanAt(8, 1, 1) }
      ],
      span
    }
  };
}

describe('compiler-api runtime directives and assertions', () => {
  it('parses assert(...) payload and infers cycle when omitted', () => {
    const ast = makeAst();
    const parsed = parseAssertionDirectiveValue(
      ast,
      spanAt(6, 1, 1),
      'assert(at=@0,1, reg=R2, equals=0x2A)'
    );

    if ('message' in parsed) {
      throw new Error(`unexpected parse failure: ${parsed.message}`);
    }

    expect(parsed.cycle).toBe(0);
    expect(parsed.row).toBe(0);
    expect(parsed.col).toBe(1);
    expect(parsed.register).toBe('R2');
    expect(parsed.value).toBe(42);
  });

  it('parses assert(...) with explicit cycle and validates fields', () => {
    const ast = makeAst();
    const ok = parseAssertionDirectiveValue(
      ast,
      spanAt(10, 1, 1),
      'assert(at=@1,2, reg=R3, equals=17, cycle=4)'
    );
    if ('message' in ok) {
      throw new Error(`unexpected parse failure: ${ok.message}`);
    }
    expect(ok).toMatchObject({
      cycle: 4,
      row: 1,
      col: 2,
      register: 'R3',
      value: 17
    });

    const badRow = parseAssertionDirectiveValue(
      ast,
      spanAt(10, 1, 1),
      'assert(at=@-1,0, reg=R1, equals=1, cycle=0)'
    );
    expect('message' in badRow).toBe(true);
    if ('message' in badRow) {
      expect(badRow.message).toContain('row');
    }

    const badValue = parseAssertionDirectiveValue(
      ast,
      spanAt(10, 1, 1),
      'assert(at=@0,0, reg=R1, equals=nope, cycle=0)'
    );
    expect('message' in badValue).toBe(true);
    if ('message' in badValue) {
      expect(badValue.message).toContain('value');
    }
  });

  it('collects directive artifacts and reports invalid runtime payloads', () => {
    const ast = makeAst();
    ast.kernel!.directives.push(
      { kind: 'const', name: 'MASK', value: '0xFFFF', span: spanAt(1, 1, 1) },
      { kind: 'alias', name: 'acc', value: 'R1', span: spanAt(2, 1, 1) }
    );
    ast.kernel!.runtime!.push(
      { kind: 'io_load', addresses: ['100', '104'], raw: 'io.load(100, 104)', span: spanAt(3, 1, 1) },
      { kind: 'io_store', addresses: ['200'], raw: 'io.store(200)', span: spanAt(4, 1, 1) },
      { kind: 'limit', value: '12', raw: 'limit(12)', span: spanAt(5, 1, 1) },
      {
        kind: 'assert',
        at: { row: '0', col: '0' },
        reg: 'R1',
        equals: '30',
        cycle: '4',
        raw: 'assert(at=@0,0, reg=R1, equals=30, cycle=4)',
        span: spanAt(6, 1, 1)
      }
    );

    const diagnostics: any[] = [];
    const symbols = createEmptySymbolCollections();
    const artifacts = collectDirectiveArtifacts(ast, diagnostics, symbols);

    expect(diagnostics).toHaveLength(0);
    expect(artifacts.ioConfig).toEqual({
      loadAddrs: [100, 104],
      storeAddrs: [200]
    });
    expect(artifacts.cycleLimit).toBe(12);
    expect(artifacts.assertions).toHaveLength(1);
    expect(symbols.constants.MASK).toBe('0xFFFF');
    expect(symbols.aliases.acc).toBe('R1');
  });

  it('emits diagnostics for invalid io/limit/assert payloads', () => {
    const ast = makeAst();
    ast.kernel!.runtime!.push(
      { kind: 'io_load', addresses: ['-1'], raw: 'io.load(-1)', span: spanAt(3, 1, 1) },
      { kind: 'io_store', addresses: [], raw: 'io.store()', span: spanAt(4, 1, 1) },
      { kind: 'limit', value: 'nope', raw: 'limit(nope)', span: spanAt(5, 1, 1) },
      {
        kind: 'assert',
        at: { row: '0', col: '0' },
        reg: 'R1',
        equals: '1',
        cycle: '-1',
        raw: 'assert(at=@0,0, reg=R1, equals=1, cycle=-1)',
        span: spanAt(6, 1, 1)
      }
    );

    const diagnostics: any[] = [];
    const symbols = createEmptySymbolCollections();
    const artifacts = collectDirectiveArtifacts(ast, diagnostics, symbols);

    expect(artifacts.ioConfig.loadAddrs).toEqual([]);
    expect(artifacts.ioConfig.storeAddrs).toEqual([]);
    expect(artifacts.cycleLimit).toBeUndefined();
    expect(artifacts.assertions).toEqual([]);
    expect(diagnostics.length).toBeGreaterThanOrEqual(4);
    expect(diagnostics.some((d) => d.code === ErrorCodes.Parse.InvalidSyntax)).toBe(true);
  });
});
