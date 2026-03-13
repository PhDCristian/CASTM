import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '../../..');

const instructionSet = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/instruction-set.json'), 'utf8'));
const targets = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/target-profiles.json'), 'utf8'));

const lines = [];
lines.push('# CASTM Instruction Reference');
lines.push('');
lines.push('| Opcode | Category | Operands | Description |');
lines.push('|---|---|---|---|');
for (const inst of instructionSet) {
  lines.push(`| \`${inst.opcode}\` | ${inst.category} | ${(inst.operands || []).join(', ') || '-'} | ${inst.description} |`);
}
lines.push('');
lines.push('## Target Profiles');
lines.push('');
for (const t of targets) {
  lines.push(`- \`${t.id}\`: ${t.description} (${t.grid.rows}x${t.grid.cols}, ${t.grid.topology}, ${t.grid.wrapPolicy})`);
}
lines.push('');

const outPath = path.join(root, 'docs/generated/instruction-reference.md');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, lines.join('\n'));

console.log(`Generated ${outPath}`);
