import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { compile } from '@castm/compiler-api';

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

    if (language === 'castm' || language === 'dsl') {
      snippets.push({
        source,
        mode: 'pass',
        expectedErrorCodes: []
      });
      continue;
    }

    if (language === 'castm-fail' || language === 'dsl-fail') {
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

function collectCastmFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectCastmFiles(full));
      continue;
    }
    if (entry.isFile() && full.endsWith('.castm')) {
      files.push(full);
    }
  }
  return files;
}

function extractIncludePaths(markdown: string): string[] {
  const paths: string[] = [];
  for (const line of markdown.split('\n')) {
    const include = line.match(/^\s*<<<\s+(.+)$/);
    if (!include) continue;
    let includePath = include[1].trim();
    includePath = includePath.replace(/\[[^\]]*\]\s*$/, '').trim();
    includePath = includePath.replace(/\{[^}]*\}\s*$/, '').trim();
    if (includePath) paths.push(includePath);
  }
  return paths;
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

      for (const includePath of extractIncludePaths(content)) {
        const resolved = includePath.startsWith('/')
          ? includePath
          : path.resolve(path.dirname(file), includePath);
        expect(fs.existsSync(resolved), `Broken include in ${file}: ${includePath}`).toBe(true);
      }

      for (const snippet of extractDslSnippets(content)) {
        snippets.push({ file, snippet });
      }
    }

    expect(snippets.length).toBeGreaterThan(0);
    expect(snippets.some(({ snippet }) => snippet.mode === 'pass')).toBe(true);

    for (const item of snippets) {
      const source = resolveSnippetSource(item.file, item.snippet.source);
      const result = compile(source, { strictUnsupported: false });
      if (item.snippet.mode === 'pass') {
        expect(result.success, `Snippet failed in ${item.file}\n${source}`).toBe(true);
        continue;
      }

      expect(result.success, `Fail-snippet unexpectedly succeeded in ${item.file}\n${source}`).toBe(
        false
      );
      for (const expectedCode of item.snippet.expectedErrorCodes) {
        expect(
          result.diagnostics.some((diag) => diag.code === expectedCode),
          `Missing expected diagnostic ${expectedCode} in ${item.file}\n${source}`
        ).toBe(true);
      }
    }

    const snippetsRoot = path.resolve(__dirname, '../docs-site/snippets');
    const snippetFiles = collectCastmFiles(snippetsRoot);
    expect(snippetFiles.length).toBeGreaterThan(0);

    for (const snippetFile of snippetFiles) {
      const source = fs.readFileSync(snippetFile, 'utf8');
      const result = compile(source, { strictUnsupported: false });
      const lower = snippetFile.toLowerCase();
      const expectsFailure = lower.includes('invalid') || lower.includes('fail');
      if (expectsFailure) {
        expect(result.success, `Expected snippet failure: ${snippetFile}`).toBe(false);
      } else {
        expect(result.success, `Expected snippet success: ${snippetFile}`).toBe(true);
      }
    }
  });
});
