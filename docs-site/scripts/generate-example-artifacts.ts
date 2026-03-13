import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile, emit } from '../../packages/compiler-api/src/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const artifactsDir = path.resolve(__dirname, '../examples/artifacts');
const excerptLineLimit = 30;

function toExcerpt(csv: string, maxLines: number): string {
  const lines = csv.trim().split('\n');
  return `${lines.slice(0, maxLines).join('\n')}\n`;
}

function main(): void {
  if (!fs.existsSync(artifactsDir)) {
    throw new Error(`Artifacts directory not found: ${artifactsDir}`);
  }

  const entries = fs.readdirSync(artifactsDir)
    .filter((name) => name.endsWith('.castm'))
    .sort();

  if (entries.length === 0) {
    throw new Error(`No .castm files found in ${artifactsDir}`);
  }

  for (const fileName of entries) {
    const base = fileName.slice(0, -'.castm'.length);
    const sourcePath = path.join(artifactsDir, fileName);
    const fullCsvPath = path.join(artifactsDir, `${base}.csv`);
    const excerptCsvPath = path.join(artifactsDir, `${base}.excerpt.csv`);

    const source = fs.readFileSync(sourcePath, 'utf8');
    const result = compile(source, { emitArtifacts: ['mir'], strictUnsupported: false });
    if (!result.success || !result.artifacts.mir) {
      const details = result.diagnostics.map((d) => `${d.code}: ${d.message}`).join(' | ');
      throw new Error(`Failed compiling ${fileName}: ${details}`);
    }

    const emitted = emit(result.artifacts.mir, {
      format: 'sim-matrix-csv',
      includeCycleHeader: true
    });
    if (!emitted.success || !emitted.csv) {
      throw new Error(`Failed emitting CSV for ${fileName}`);
    }

    fs.writeFileSync(fullCsvPath, `${emitted.csv.trim()}\n`);
    fs.writeFileSync(excerptCsvPath, toExcerpt(emitted.csv, excerptLineLimit));
    console.log(`generated ${path.basename(fullCsvPath)} and ${path.basename(excerptCsvPath)}`);
  }
}

main();
