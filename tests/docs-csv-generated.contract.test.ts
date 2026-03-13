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

describe('docs generated CSV policy', () => {
  it('rejects inline manual CSV in pragmas pages and requires generated includes', () => {
    const root = path.resolve(process.cwd(), 'docs-site/features/pragmas');
    const pages = pragmaPages(root);

    for (const page of pages) {
      const content = fs.readFileSync(page, 'utf8');

      const csvFences = content.match(/```csv[\s\S]*?```/gim) ?? [];
      for (const fence of csvFences) {
        const inner = fence
          .replace(/^```csv\s*/i, '')
          .replace(/```\s*$/i, '')
          .trim();
        expect(
          /^<<<\s+.+\.excerpt\.csv\{csv\}.+$/i.test(inner),
          `inline/manual CSV found in ${page}`
        ).toBe(true);
      }

      const manualMatrixRows = /\n\s*\d+,,,\s*\n/im.test(content);
      expect(manualMatrixRows, `manual matrix CSV rows found in ${page}`).toBe(false);

      const includes = content.match(/^\s*<<<\s+(.+\{csv\}.+)$/gim) ?? [];
      expect(includes.length, `insufficient CSV includes in ${page}`).toBeGreaterThanOrEqual(4);

      for (const line of includes) {
        const includePath = line.replace(/^\s*<<<\s+/, '').trim();
        expect(includePath.includes('../../snippets/pragmas/')).toBe(true);
      }
    }
  });
});
