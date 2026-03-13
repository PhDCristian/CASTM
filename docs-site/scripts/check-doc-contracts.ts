import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const docsRoot = path.resolve(__dirname, '..');
const pragmasDir = path.resolve(docsRoot, 'features/pragmas');
const examplesDir = path.resolve(docsRoot, 'examples');
const coreFeaturePages = [
  'features/expressions.md',
  'features/memory-sugar.md',
  'features/loops.md',
  'features/control-flow.md',
  'features/coordinate-expressions.md',
  'features/dynamic-coordinates.md',
  'features/broadcast-syntax.md',
  'features/functions.md',
  'features/spatial-short-forms.md',
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

interface Violation {
  file: string;
  message: string;
}

function listPragmaPages(): string[] {
  return fs
    .readdirSync(pragmasDir)
    .filter((name) => name.endsWith('.md') && name !== 'index.md')
    .sort()
    .map((name) => path.join(pragmasDir, name));
}

function listExamplePages(): string[] {
  return fs
    .readdirSync(examplesDir)
    .filter((name) => name.endsWith('.md'))
    .sort()
    .map((name) => path.join(examplesDir, name));
}

function count(content: string, pattern: RegExp): number {
  return (content.match(pattern) ?? []).length;
}

function hasCanonicalTargetMention(content: string): boolean {
  return /target\s+base\b/i.test(content) || /target\s+"uma-cgra-base"/i.test(content);
}

function checkPragmaPage(file: string): Violation[] {
  const content = fs.readFileSync(file, 'utf8');
  const violations: Violation[] = [];

  const requiredHeadings = [
    '## When to use',
    '## Target and assumptions',
    '## Syntax',
    '## Parameters',
    '## Case A — Minimal',
    '## Case B — Advanced options',
    '## Case C — Integration in kernel',
    '## Case D — Edge / boundary',
    '## Case E — Invalid usage',
    '## Lowering notes',
    '## Related patterns',
  ];
  for (const heading of requiredHeadings) {
    if (!content.includes(heading)) {
      violations.push({ file, message: `missing heading: ${heading}` });
    }
  }

  const codeGroups = count(content, /:::\s*code-group/g);
  if (codeGroups < 4) {
    violations.push({ file, message: `expected at least 4 code-group blocks, found ${codeGroups}` });
  }

  const csvIncludes = count(content, /^\s*<<<\s+.+\{csv\}.+$/gim);
  if (csvIncludes < 4) {
    violations.push({ file, message: `expected at least 4 CSV includes, found ${csvIncludes}` });
  }

  const hasFailFence = /```castm-fail\b[\s\S]*?```/im.test(content);
  const hasFailInclude = /^\s*<<<\s+.+\{castm-fail\}.+$/gim.test(content);
  if (!hasFailFence && !hasFailInclude) {
    violations.push({ file, message: 'expected at least one castm-fail block' });
  }

  if (!hasCanonicalTargetMention(content)) {
    violations.push({ file, message: 'missing explicit target mention (`target base;`)' });
  }

  const csvFences = content.match(/```csv[\s\S]*?```/gim) ?? [];
  for (const block of csvFences) {
    const inner = block
      .replace(/^```csv\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();
    if (!/^<<<\s+.+\{csv\}.+$/i.test(inner)) {
      violations.push({ file, message: 'inline/manual CSV block detected; use generated include' });
    }
  }

  const exampleLinks = count(content, /\]\(\/examples\//g);
  if (exampleLinks < 1) {
    violations.push({ file, message: 'expected at least one related /examples/ link' });
  }

  return violations;
}

function checkCoreFeaturePage(file: string): Violation[] {
  const content = fs.readFileSync(file, 'utf8');
  const violations: Violation[] = [];

  if (!hasCanonicalTargetMention(content)) {
    violations.push({ file, message: 'missing explicit target mention (`target base;`)' });
  }

  const codeGroups = count(content, /:::\s*code-group/g);
  if (codeGroups < 5) {
    violations.push({ file, message: `expected at least 5 code-group blocks, found ${codeGroups}` });
  }

  const csvIncludes = count(content, /^\s*<<<\s+.+\{csv\}.+$/gim);
  if (csvIncludes < 5) {
    violations.push({ file, message: `expected at least 5 CSV includes, found ${csvIncludes}` });
  }

  const hasFailFence = /```castm-fail\b[\s\S]*?```/im.test(content);
  const hasFailInclude = /^\s*<<<\s+.+\{castm-fail\}.+$/gim.test(content);
  if (!hasFailFence && !hasFailInclude) {
    violations.push({ file, message: 'expected at least one castm-fail block/include' });
  }

  const exampleLinks = count(content, /\]\(\/examples\//g);
  if (exampleLinks < 1) {
    violations.push({ file, message: 'expected at least one related /examples/ link' });
  }

  return violations;
}

function checkExamplePage(file: string): Violation[] {
  const content = fs.readFileSync(file, 'utf8');
  const violations: Violation[] = [];

  for (const heading of requiredExampleSections) {
    if (!content.includes(heading)) {
      violations.push({ file, message: `missing heading: ${heading}` });
    }
  }

  if (!hasCanonicalTargetMention(content)) {
    violations.push({ file, message: 'missing explicit target mention (`target base;`)' });
  }

  const codeGroups = count(content, /:::\s*code-group/g);
  if (codeGroups < 1) {
    violations.push({ file, message: `expected at least 1 code-group block, found ${codeGroups}` });
  }

  const csvIncludes = count(content, /^\s*<<<\s+.+\{csv\}.+$/gim);
  if (csvIncludes < 1) {
    violations.push({ file, message: `expected at least 1 CSV include, found ${csvIncludes}` });
  }

  const featureLinks = count(content, /\]\(\/features\//g);
  if (featureLinks < 3) {
    violations.push({ file, message: `expected at least 3 related /features/ links, found ${featureLinks}` });
  }

  return violations;
}

function main(): void {
  const pragmaPages = listPragmaPages();
  const examplePages = listExamplePages();
  const allViolations = [
    ...pragmaPages.flatMap(checkPragmaPage),
    ...coreFeaturePages.flatMap((relativePath) => checkCoreFeaturePage(path.join(docsRoot, relativePath))),
    ...examplePages.flatMap(checkExamplePage),
  ];

  if (allViolations.length > 0) {
    console.error('Documentation contract violations found:');
    for (const v of allViolations) {
      console.error(`- ${path.relative(process.cwd(), v.file)}: ${v.message}`);
    }
    process.exit(1);
  }

  console.log(
    `Documentation contract passed for ${pragmaPages.length} pragmas pages, ${coreFeaturePages.length} core feature pages and ${examplePages.length} examples pages.`,
  );
}

main();
