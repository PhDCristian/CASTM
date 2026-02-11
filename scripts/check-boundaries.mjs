import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const packagesDir = path.join(root, 'packages');

const rules = {
  'lang-spec': [],
  'compiler-ir': ['@openedge/lang-spec'],
  'compiler-front': ['@openedge/lang-spec', '@openedge/compiler-ir'],
  'compiler-backend-csv': ['@openedge/compiler-ir'],
  'compiler-api': ['@openedge/lang-spec', '@openedge/compiler-ir', '@openedge/compiler-front', '@openedge/compiler-backend-csv'],
  'lsp-server': ['@openedge/lang-spec', '@openedge/compiler-ir', '@openedge/compiler-api'],
  'cli': ['@openedge/compiler-api'],
  'testkit': ['@openedge/compiler-ir', '@openedge/compiler-api']
};

function walkTsFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkTsFiles(full));
      continue;
    }
    if (entry.isFile() && (full.endsWith('.ts') || full.endsWith('.tsx'))) {
      out.push(full);
    }
  }
  return out;
}

const violations = [];
if (!fs.existsSync(packagesDir)) {
  console.error(`Packages directory not found: ${packagesDir}`);
  process.exit(1);
}

for (const pkg of Object.keys(rules)) {
  const srcDir = path.join(packagesDir, pkg, 'src');
  if (!fs.existsSync(srcDir)) continue;
  const allowed = new Set(rules[pkg]);

  for (const file of walkTsFiles(srcDir)) {
    const text = fs.readFileSync(file, 'utf8');
    const importRe = /from\s+['"](@openedge\/[a-z-]+)['"]/g;
    let m;
    while ((m = importRe.exec(text)) !== null) {
      const dep = m[1];
      if (!allowed.has(dep)) {
        violations.push(`${path.relative(root, file)} imports ${dep} (not allowed for ${pkg})`);
      }
    }
  }
}

if (violations.length > 0) {
  console.error('Import boundary violations:');
  for (const v of violations) console.error(`- ${v}`);
  process.exit(1);
}

console.log('Boundary check passed.');
