import { describe, expect, it } from 'vitest';
import {
  AstProgram,
  ErrorCodes,
  spanAt
} from '@openedge/compiler-ir';
import { parseAssertionDirectiveValue } from '../packages/compiler-api/src/compiler-driver/assertions.js';
import { collectDirectiveArtifacts } from '../packages/compiler-api/src/compiler-driver/runtime-artifacts/directives.js';
import { createEmptySymbolCollections } from '../packages/compiler-api/src/compiler-driver/runtime-artifacts/symbols.js';

function makeAst(): AstProgram {
  const span = spanAt(1, 1, 1);
  return {
    targetProfileId: 'uma-cgra-base',
    span,
    kernel: {
      name: 'k',
      config: undefined,
      pragmas: [],
      directives: [],
      cycles: [
        { index: 0, statements: [], span: spanAt(3, 1, 1) },
        { index: 4, statements: [], span: spanAt(8, 1, 1) }
      ],
      span
    }
  };
}

describe('compiler-api runtime directives and assertions', () => {
  it('parses .assert shorthand and infers cycle when omitted', () => {
    const ast = makeAst();
    const parsed = parseAssertionDirectiveValue(
      ast,
      spanAt(6, 1, 1),
      '.assert @0,1 R2 == 0x2A'
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

  it('parses .assert object payload and validates fields', () => {
    const ast = makeAst();
    const ok = parseAssertionDirectiveValue(
      ast,
      spanAt(10, 1, 1),
      '.assert { cycle: 4, location: 1,2, register: R3, value: 17 }'
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
      '.assert cycle=0 @-1,0 R1 == 1'
    );
    expect('message' in badRow).toBe(true);
    if ('message' in badRow) {
      expect(badRow.message).toContain('row');
    }

    const badValue = parseAssertionDirectiveValue(
      ast,
      spanAt(10, 1, 1),
      '.assert cycle=0 @0,0 R1 == nope'
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
      { kind: 'alias', name: 'acc', value: 'R1', span: spanAt(2, 1, 1) },
      { kind: 'io_load', name: 'io_load', value: '.io_load 100, 104', span: spanAt(3, 1, 1) },
      { kind: 'io_store', name: 'io_store', value: '.io_store 200', span: spanAt(4, 1, 1) },
      { kind: 'limit', name: 'limit', value: '.limit 12', span: spanAt(5, 1, 1) },
      { kind: 'assert', name: 'assert', value: '.assert cycle=4 @0,0 R1 == 30', span: spanAt(6, 1, 1) }
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
    ast.kernel!.directives.push(
      { kind: 'io_load', name: 'io_load', value: '.io_load -1', span: spanAt(3, 1, 1) },
      { kind: 'io_store', name: 'io_store', value: '.io_store ', span: spanAt(4, 1, 1) },
      { kind: 'limit', name: 'limit', value: '.limit nope', span: spanAt(5, 1, 1) },
      { kind: 'assert', name: 'assert', value: '.assert cycle=-1 @0,0 R1 == 1', span: spanAt(6, 1, 1) }
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
