import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { compile } from '@openedge/compiler-api';

interface DslSnippet {
  source: string;
  mode: 'pass' | 'fail';
  expectedErrorCodes: string[];
}

function collectMarkdownFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  const ignoredDirs = new Set(['node_modules', '.vitepress', 'dist']);

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (ignoredDirs.has(entry.name)) {
        continue;
      }
      files.push(...collectMarkdownFiles(full));
      continue;
    }
    if (entry.isFile() && full.endsWith('.md')) {
      files.push(full);
    }
  }

  return files;
}

function extractDslSnippets(markdown: string): DslSnippet[] {
  const snippets: DslSnippet[] = [];
  const regex = /```([^\n]*)\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(markdown)) !== null) {
    const info = match[1].trim();
    const language = info.split(/\s+/)[0]?.toLowerCase();
    if (!language) continue;

    const source = match[2].trim();
    if (!source) continue;

    if (language === 'openedge' || language === 'dsl') {
      snippets.push({
        source,
        mode: 'pass',
        expectedErrorCodes: []
      });
      continue;
    }

    if (language === 'openedge-fail' || language === 'dsl-fail') {
      const expectedErrorCodes = Array.from(
        source.matchAll(/^\s*\/\/\s*expect-error:\s*([A-Z]\d{4})\s*$/gim)
      ).map((codeMatch) => codeMatch[1]);

      snippets.push({
        source,
        mode: 'fail',
        expectedErrorCodes
      });
    }
  }

  return snippets;
}

describe('docs snippets contracts', () => {
  it('compiles executable DSL snippets from canonical docs and docs-site', () => {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const docsRoots = [
      path.resolve(__dirname, '../docs/language'),
      path.resolve(__dirname, '../docs-site')
    ];
    const markdownFiles = docsRoots.flatMap((root) => collectMarkdownFiles(root));

    const snippets: Array<{ file: string; snippet: DslSnippet }> = [];
    for (const file of markdownFiles) {
      const content = fs.readFileSync(file, 'utf8');
      for (const snippet of extractDslSnippets(content)) {
        snippets.push({ file, snippet });
      }
    }

    expect(snippets.length).toBeGreaterThan(0);
    expect(snippets.some(({ snippet }) => snippet.mode === 'pass')).toBe(true);

    for (const item of snippets) {
      const result = compile(item.snippet.source, { strictUnsupported: false });
      if (item.snippet.mode === 'pass') {
        expect(result.success, `Snippet failed in ${item.file}\n${item.snippet.source}`).toBe(true);
        continue;
      }

      expect(result.success, `Fail-snippet unexpectedly succeeded in ${item.file}\n${item.snippet.source}`).toBe(
        false
      );
      for (const expectedCode of item.snippet.expectedErrorCodes) {
        expect(
          result.diagnostics.some((diag) => diag.code === expectedCode),
          `Missing expected diagnostic ${expectedCode} in ${item.file}\n${item.snippet.source}`
        ).toBe(true);
      }
    }
  });
});
