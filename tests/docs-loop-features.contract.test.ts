import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { compile } from '@openedge/compiler-api';

interface ExtractedSnippet {
  source: string;
  mode: 'pass' | 'fail';
  expectedErrorCodes: string[];
}

function extractOpenEdgeSnippets(markdown: string): ExtractedSnippet[] {
  const snippets: ExtractedSnippet[] = [];
  const fenceRegex = /```([^\n]*)\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;

  while ((match = fenceRegex.exec(markdown)) !== null) {
    const info = match[1].trim();
    const language = info.split(/\s+/)[0]?.toLowerCase();
    if (!language) continue;

    const source = match[2].trim();
    if (!source) continue;

    if (language === 'openedge' || language === 'dsl') {
      snippets.push({ source, mode: 'pass', expectedErrorCodes: [] });
      continue;
    }

    if (language === 'openedge-fail' || language === 'dsl-fail') {
      const expectedErrorCodes = Array.from(
        source.matchAll(/^\s*\/\/\s*expect-error:\s*([A-Z]\d{4})\s*$/gim)
      ).map((m) => m[1]);
      snippets.push({ source, mode: 'fail', expectedErrorCodes });
    }
  }

  return snippets;
}

describe('docs-site loop feature contracts', () => {
  it('keeps loop modifiers and scheduler examples executable and covered', () => {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const files = [
      path.resolve(__dirname, '../docs-site/features/loops.md'),
      path.resolve(__dirname, '../docs-site/features/pragmas/parallel.md'),
      path.resolve(__dirname, '../docs-site/features/pragmas/unroll.md'),
      path.resolve(__dirname, '../docs-site/examples/loop-strategies.md'),
      path.resolve(__dirname, '../docs-site/examples/for-control-flow.md'),
      path.resolve(__dirname, '../docs-site/examples/scheduler-modes.md')
    ];

    const snippets: ExtractedSnippet[] = files.flatMap((file) =>
      extractOpenEdgeSnippets(fs.readFileSync(file, 'utf8'))
    );

    const passSnippets = snippets.filter((snippet) => snippet.mode === 'pass');
    const failSnippets = snippets.filter((snippet) => snippet.mode === 'fail');

    expect(passSnippets.length).toBeGreaterThanOrEqual(14);
    expect(failSnippets.length).toBeGreaterThanOrEqual(5);

    expect(passSnippets.some((snippet) => /\bunroll\(/.test(snippet.source))).toBe(true);
    expect(passSnippets.some((snippet) => /\bcollapse\(/.test(snippet.source))).toBe(true);
    expect(passSnippets.some((snippet) => /\bruntime\b/.test(snippet.source))).toBe(true);
    expect(passSnippets.some((snippet) => /\bif\s*\(/.test(snippet.source))).toBe(true);
    expect(passSnippets.some((snippet) => /\bwhile\s*\(/.test(snippet.source))).toBe(true);

    for (const snippet of passSnippets) {
      const result = compile(snippet.source);
      expect(result.success, `Expected docs snippet to compile:\n${snippet.source}`).toBe(true);
    }

    for (const snippet of failSnippets) {
      const result = compile(snippet.source);
      expect(result.success, `Expected docs fail-snippet to fail:\n${snippet.source}`).toBe(false);
      for (const code of snippet.expectedErrorCodes) {
        expect(
          result.diagnostics.some((diag) => diag.code === code),
          `Expected diagnostic ${code} in fail-snippet:\n${snippet.source}`
        ).toBe(true);
      }
    }
  });
});
