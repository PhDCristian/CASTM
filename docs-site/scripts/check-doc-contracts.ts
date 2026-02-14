import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pragmasDir = path.resolve(__dirname, '../features/pragmas');
const docsRoot = path.resolve(__dirname, '..');

const requiredReferencePages = [
  'index.md',
  'examples/overview.md',
  'examples/kernel-compaction.md',
  'features/memory-sugar.md',
  'language/README.md',
  'language/compilation.md',
  'language/dsl-csv-equivalence.md',
  'language/grammar.md',
  'language/instruction-set.md',
  'guide/cli-reference.md',
  'guide/library-usage.md',
  'reference/error-codes.md',
  'reference/porting-guide.md',
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

function checkPage(file: string): Violation[] {
  const content = fs.readFileSync(file, 'utf8');
  const violations: Violation[] = [];

  const codeGroups = (content.match(/:::\s*code-group/g) ?? []).length;
  if (codeGroups < 2) {
    violations.push({ file, message: `expected at least 2 code-group blocks, found ${codeGroups}` });
  }

  const csvIncludes = (content.match(/^\s*<<<\s+.+\{csv\}.+$/gim) ?? []).length;
  if (csvIncludes < 2) {
    violations.push({ file, message: `expected at least 2 CSV includes, found ${csvIncludes}` });
  }

  const hasFailFence = /```openedge-fail\b[\s\S]*?```/im.test(content);
  const hasFailInclude = /^\s*<<<\s+.+\{openedge-fail\}.+$/gim.test(content);
  if (!hasFailFence && !hasFailInclude) {
    violations.push({ file, message: 'expected at least one openedge-fail block' });
  }

  if (!/target\s+"uma-cgra-base"/i.test(content)) {
    violations.push({ file, message: 'missing explicit target mention (`target "uma-cgra-base"`)' });
  }

  if (/```csv[\s\S]*?(?:^\s*[^<\n].*$)+/gim.test(content)) {
    // Allow fenced CSV only if it is a pure include line.
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
  }

  return violations;
}

function main(): void {
  const pages = listPragmaPages();
  const violations = pages.flatMap(checkPage);
  const referenceViolations: Violation[] = [];

  for (const relativePath of requiredReferencePages) {
    const file = path.join(docsRoot, relativePath);
    const content = fs.readFileSync(file, 'utf8');

    const codeGroups = (content.match(/:::\s*code-group/g) ?? []).length;
    if (codeGroups < 1) {
      referenceViolations.push({ file, message: `expected at least 1 code-group block, found ${codeGroups}` });
    }

    const csvIncludes = (content.match(/^\s*<<<\s+.+\{csv\}.+$/gim) ?? []).length;
    if (csvIncludes < 1) {
      referenceViolations.push({ file, message: `expected at least 1 CSV include, found ${csvIncludes}` });
    }

    if (!/target\s+"uma-cgra-base"/i.test(content)) {
      referenceViolations.push({ file, message: 'missing explicit target mention (`target "uma-cgra-base"`)' });
    }
  }

  const allViolations = [...violations, ...referenceViolations];

  if (allViolations.length > 0) {
    console.error('Documentation contract violations found:');
    for (const v of allViolations) {
      console.error(`- ${path.relative(process.cwd(), v.file)}: ${v.message}`);
    }
    process.exit(1);
  }

  console.log(
    `Documentation contract passed for ${pages.length} pragmas pages + ${requiredReferencePages.length} reference pages.`,
  );
}

main();
