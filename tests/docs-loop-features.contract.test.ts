import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { compile } from '@castm/compiler-api';

interface ExtractedSnippet {
  source: string;
  mode: 'pass' | 'fail';
  expectedErrorCodes: string[];
}

function extractCastmSnippets(markdown: string): ExtractedSnippet[] {
  const snippets: ExtractedSnippet[] = [];
  const fenceRegex = /```([^\n]*)\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;

  while ((match = fenceRegex.exec(markdown)) !== null) {
    const info = match[1].trim();
    const language = info.split(/\s+/)[0]?.toLowerCase();
    if (!language) continue;

    const source = match[2].trim();
    if (!source) continue;

    if (language === 'castm' || language === 'dsl') {
      snippets.push({ source, mode: 'pass', expectedErrorCodes: [] });
      continue;
    }

    if (language === 'castm-fail' || language === 'dsl-fail') {
      const expectedErrorCodes = Array.from(
        source.matchAll(/^\s*\/\/\s*expect-error:\s*([A-Z]\d{4})\s*$/gim)
      ).map((m) => m[1]);
      snippets.push({ source, mode: 'fail', expectedErrorCodes });
    }
  }

  for (const line of markdown.split('\n')) {
    const includeMatch = line.match(/^\s*<<<\s+.+\{(castm|dsl|castm-fail|dsl-fail)\}.*$/i);
    if (!includeMatch) continue;
    const language = includeMatch[1].toLowerCase();
    snippets.push({
      source: line.trim(),
      mode: language.endsWith('-fail') ? 'fail' : 'pass',
      expectedErrorCodes: []
    });
  }

  return snippets;
}

function resolveSnippetSource(markdownFile: string, source: string): string {
  const trimmed = source.trim();
  const includeMatch = trimmed.match(/^<<<\s+(.+)$/);
  if (!includeMatch) return source;

  let includePath = includeMatch[1].trim();
  includePath = includePath.replace(/\[[^\]]*\]\s*$/, '').trim();
  includePath = includePath.replace(/\{[^}]*\}\s*$/, '').trim();
  if (!includePath) return source;

  const resolved = includePath.startsWith('/')
    ? includePath
    : path.resolve(path.dirname(markdownFile), includePath);
  return fs.readFileSync(resolved, 'utf8');
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

    const snippets: Array<{ file: string; snippet: ExtractedSnippet }> = files.flatMap((file) =>
      extractCastmSnippets(fs.readFileSync(file, 'utf8')).map((snippet) => ({ file, snippet }))
    );

    const passSnippets = snippets.filter((item) => item.snippet.mode === 'pass');
    const failSnippets = snippets.filter((item) => item.snippet.mode === 'fail');

    expect(passSnippets.length).toBeGreaterThanOrEqual(14);
    expect(failSnippets.length).toBeGreaterThanOrEqual(5);

    expect(passSnippets.some((item) => /\bunroll\(/.test(resolveSnippetSource(item.file, item.snippet.source)))).toBe(
      true
    );
    expect(passSnippets.some((item) => /\bcollapse\(/.test(resolveSnippetSource(item.file, item.snippet.source)))).toBe(
      true
    );
    expect(passSnippets.some((item) => /\bruntime\b/.test(resolveSnippetSource(item.file, item.snippet.source)))).toBe(
      true
    );
    expect(passSnippets.some((item) => /\bif\s*\(/.test(resolveSnippetSource(item.file, item.snippet.source)))).toBe(
      true
    );
    expect(passSnippets.some((item) => /\bwhile\s*\(/.test(resolveSnippetSource(item.file, item.snippet.source)))).toBe(
      true
    );

    for (const item of passSnippets) {
      const source = resolveSnippetSource(item.file, item.snippet.source);
      const result = compile(source);
      expect(result.success, `Expected docs snippet to compile:\n${source}`).toBe(true);
    }

    for (const item of failSnippets) {
      const source = resolveSnippetSource(item.file, item.snippet.source);
      const result = compile(source);
      expect(result.success, `Expected docs fail-snippet to fail:\n${source}`).toBe(false);
      for (const code of item.snippet.expectedErrorCodes) {
        expect(
          result.diagnostics.some((diag) => diag.code === code),
          `Expected diagnostic ${code} in fail-snippet:\n${source}`
        ).toBe(true);
      }
    }
  });
});
