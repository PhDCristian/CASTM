import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function pragmaPages(root: string): string[] {
  return fs
    .readdirSync(root)
    .filter((name) => name.endsWith('.md') && name !== 'index.md')
    .sort()
    .map((name) => path.join(root, name));
}

describe('docs pragmas contract', () => {
  it('enforces canonical page template for each pragma page', () => {
    const root = path.resolve(process.cwd(), 'docs-site/features/pragmas');
    const pages = pragmaPages(root);
    expect(pages.length).toBeGreaterThanOrEqual(26);

    for (const page of pages) {
      const content = fs.readFileSync(page, 'utf8');

      expect(content).toContain('## When to use');
      expect(content).toContain('## Target and assumptions');
      expect(content).toContain('## Syntax');
      expect(content).toContain('## Parameters');
      expect(content).toContain('## Case A — Minimal');
      expect(content).toContain('## Case B — Advanced options');
      expect(content).toContain('## Case C — Integration in kernel');
      expect(content).toContain('## Case D — Edge / boundary');
      expect(content).toContain('## Case E — Invalid usage');
      expect(content).toContain('## Lowering notes');
      expect(content).toContain('## Related patterns');

      const codeGroups = (content.match(/:::\s*code-group/g) ?? []).length;
      expect(codeGroups, `missing code groups in ${page}`).toBeGreaterThanOrEqual(4);

      const csvIncludes = (content.match(/^\s*<<<\s+.+\{csv\}.+$/gim) ?? []).length;
      expect(csvIncludes, `missing CSV includes in ${page}`).toBeGreaterThanOrEqual(4);

      const hasFailFence = /```castm-fail\b[\s\S]*?```/im.test(content);
      const hasFailInclude = /^\s*<<<\s+.+\{castm-fail\}.+$/gim.test(content);
      expect(hasFailFence || hasFailInclude, `missing invalid snippet in ${page}`).toBe(true);
      expect(content, `missing target mention in ${page}`).toMatch(/target\s+base|target\s+"uma-cgra-base"/i);
      expect(content, `missing related examples link in ${page}`).toMatch(/\]\(\/examples\//);
    }
  });
});
