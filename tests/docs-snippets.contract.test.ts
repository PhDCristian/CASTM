import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { compile } from '@openedge/compiler-api';

function collectMarkdownFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectMarkdownFiles(full));
      continue;
    }
    if (entry.isFile() && full.endsWith('.md')) {
      files.push(full);
    }
  }

  return files;
}

function extractDslSnippets(markdown: string): string[] {
  const snippets: string[] = [];
  const regex = /```(?:openedge|dsl)\n([\s\S]*?)```/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(markdown)) !== null) {
    snippets.push(match[1].trim());
  }
  return snippets;
}

describe('docs snippets contracts', () => {
  it('compiles executable DSL snippets from docs', () => {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const docsRoot = path.resolve(__dirname, '../docs');
    const markdownFiles = collectMarkdownFiles(docsRoot);

    const snippets: Array<{ file: string; source: string }> = [];
    for (const file of markdownFiles) {
      const content = fs.readFileSync(file, 'utf8');
      for (const source of extractDslSnippets(content)) {
        snippets.push({ file, source });
      }
    }

    expect(snippets.length).toBeGreaterThan(0);

    for (const snippet of snippets) {
      const result = compile(snippet.source, { strictUnsupported: false });
      expect(result.success, `Snippet failed in ${snippet.file}\n${snippet.source}`).toBe(true);
    }
  });
});
