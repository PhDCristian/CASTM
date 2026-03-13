import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const coreFeaturePages = [
  'docs-site/features/expressions.md',
  'docs-site/features/memory-sugar.md',
  'docs-site/features/loops.md',
  'docs-site/features/control-flow.md',
  'docs-site/features/coordinate-expressions.md',
  'docs-site/features/dynamic-coordinates.md',
  'docs-site/features/broadcast-syntax.md',
  'docs-site/features/functions.md',
  'docs-site/features/spatial-short-forms.md',
];

const requiredExampleSections = [
  '## What this demonstrates',
  '## When to use',
  '## Target and assumptions',
  '## CASTM ↔ CSV',
  '## Why this CSV looks like this',
  '## Related features',
  '## Continue',
];

function listExamplesPages(root: string): string[] {
  return fs
    .readdirSync(root)
    .filter((name) => name.endsWith('.md'))
    .sort()
    .map((name) => path.join(root, name));
}

describe('docs features/examples contracts', () => {
  it('enforces 5+1 template for core feature pages', () => {
    for (const relative of coreFeaturePages) {
      const file = path.resolve(process.cwd(), relative);
      const content = fs.readFileSync(file, 'utf8');

      expect(content, `missing target mention in ${relative}`).toMatch(/target\s+base|target\s+"uma-cgra-base"/i);

      const codeGroups = (content.match(/:::\s*code-group/g) ?? []).length;
      expect(codeGroups, `insufficient code-group blocks in ${relative}`).toBeGreaterThanOrEqual(5);

      const csvIncludes = (content.match(/^\s*<<<\s+.+\{csv\}.+$/gim) ?? []).length;
      expect(csvIncludes, `insufficient CSV includes in ${relative}`).toBeGreaterThanOrEqual(5);

      const hasFailFence = /```castm-fail\b[\s\S]*?```/im.test(content);
      const hasFailInclude = /^\s*<<<\s+.+\{castm-fail\}.+$/gim.test(content);
      expect(hasFailFence || hasFailInclude, `missing invalid case in ${relative}`).toBe(true);

      const examplesLinks = (content.match(/\]\(\/examples\//g) ?? []).length;
      expect(examplesLinks, `missing examples links in ${relative}`).toBeGreaterThanOrEqual(1);
    }
  });

  it('enforces sectioned template for examples pages', () => {
    const pages = listExamplesPages(path.resolve(process.cwd(), 'docs-site/examples'));
    expect(pages.length).toBeGreaterThanOrEqual(12);

    for (const file of pages) {
      const content = fs.readFileSync(file, 'utf8');
      for (const heading of requiredExampleSections) {
        expect(content, `missing ${heading} in ${file}`).toContain(heading);
      }

      expect(content, `missing target mention in ${file}`).toMatch(/target\s+base|target\s+"uma-cgra-base"/i);

      const codeGroups = (content.match(/:::\s*code-group/g) ?? []).length;
      expect(codeGroups, `missing code-group in ${file}`).toBeGreaterThanOrEqual(1);

      const csvIncludes = (content.match(/^\s*<<<\s+.+\{csv\}.+$/gim) ?? []).length;
      expect(csvIncludes, `missing CSV include in ${file}`).toBeGreaterThanOrEqual(1);

      const featuresLinks = (content.match(/\]\(\/features\//g) ?? []).length;
      expect(featuresLinks, `insufficient feature links in ${file}`).toBeGreaterThanOrEqual(3);
    }
  });
});
