import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile, emit } from '../../packages/compiler-api/src/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const snippetsRoot = path.resolve(__dirname, '../snippets');
const excerptLineLimit = 28;

interface SnippetEntry {
  sourcePath: string;
  expectsFailure: boolean;
}

function collectEdslFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const out: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectEdslFiles(full));
      continue;
    }
    if (entry.isFile() && full.endsWith('.castm')) out.push(full);
  }
  return out;
}

function toExcerpt(csv: string, maxLines: number): string {
  const lines = csv.trim().split('\n');
  return `${lines.slice(0, maxLines).join('\n')}\n`;
}

function classifySnippet(sourcePath: string): SnippetEntry {
  const base = path.basename(sourcePath).toLowerCase();
  return {
    sourcePath,
    expectsFailure: base.includes('invalid') || base.includes('fail')
  };
}

function assertNoLegacyCompileConfig(sourcePath: string): void {
  const configPath = sourcePath.replace(/\.castm$/i, '.compile.json');
  if (fs.existsSync(configPath)) {
    throw new Error(
      `Legacy compile-config sidecar is not allowed: ${configPath}. ` +
      'Move build/runtime settings into the snippet source (`target` + `build` + runtime statements).'
    );
  }
}

function removeCsvArtifacts(sourcePath: string): void {
  const csvPath = sourcePath.replace(/\.castm$/i, '.csv');
  const excerptPath = sourcePath.replace(/\.castm$/i, '.excerpt.csv');
  if (fs.existsSync(csvPath)) fs.unlinkSync(csvPath);
  if (fs.existsSync(excerptPath)) fs.unlinkSync(excerptPath);
}

function main(): void {
  if (!fs.existsSync(snippetsRoot)) {
    throw new Error(`Snippets root not found: ${snippetsRoot}`);
  }

  const files = collectEdslFiles(snippetsRoot).sort();
  if (files.length === 0) {
    throw new Error(`No .castm snippets found under ${snippetsRoot}`);
  }

  let generated = 0;
  let invalidChecked = 0;

  for (const sourcePath of files) {
    const entry = classifySnippet(sourcePath);
    const source = fs.readFileSync(sourcePath, 'utf8');
    assertNoLegacyCompileConfig(sourcePath);
    const result = compile(source, {
      emitArtifacts: ['mir'],
      strictUnsupported: false
    });

    if (entry.expectsFailure) {
      if (result.success) {
        throw new Error(`Expected snippet to fail but it compiled: ${sourcePath}`);
      }
      removeCsvArtifacts(sourcePath);
      invalidChecked += 1;
      continue;
    }

    if (!result.success || !result.artifacts.mir) {
      const details = result.diagnostics.map((d) => `${d.code}: ${d.message}`).join(' | ');
      throw new Error(`Failed compiling ${sourcePath}: ${details}`);
    }

    const emitted = emit(result.artifacts.mir, {
      format: 'sim-matrix-csv',
      includeCycleHeader: true
    });

    if (!emitted.success || !emitted.csv) {
      throw new Error(`Failed emitting CSV for ${sourcePath}`);
    }

    const csvPath = sourcePath.replace(/\.castm$/i, '.csv');
    const excerptPath = sourcePath.replace(/\.castm$/i, '.excerpt.csv');

    fs.writeFileSync(csvPath, `${emitted.csv.trim()}\n`);
    fs.writeFileSync(excerptPath, toExcerpt(emitted.csv, excerptLineLimit));
    generated += 1;
  }

  console.log(`Generated CSV artifacts for ${generated} snippets. Checked ${invalidChecked} invalid snippets.`);
}

main();
