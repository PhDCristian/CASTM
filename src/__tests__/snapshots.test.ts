/**
 * Snapshot Tests
 *
 * Compiles each .dsl example file and snapshots the CSV output.
 * Catches regressions when modifying the compiler.
 */
import { describe, it, expect } from 'vitest';
import { compileDslToCsv } from '@utils/dsl-compiler';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '../..');

/** Recursively find all .dsl files under a directory */
function findDslFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findDslFiles(fullPath));
    } else if (entry.name.endsWith('.dsl')) {
      results.push(fullPath);
    }
  }
  return results;
}

const exampleFiles = findDslFiles(path.join(ROOT, 'examples'));
const docDslFiles = findDslFiles(path.join(ROOT, 'docs/examples'));
const allDslFiles = [...exampleFiles, ...docDslFiles];

describe('Snapshot Tests', () => {
  for (const filePath of allDslFiles) {
    const relPath = path.relative(ROOT, filePath);

    it(`should compile ${relPath}`, () => {
      const code = fs.readFileSync(filePath, 'utf-8');
      const result = compileDslToCsv(code);

      if (result.success) {
        expect(result.csv).toBeDefined();
        expect(result.csv).toMatchSnapshot();
      } else {
        // File doesn't compile - snapshot the error for tracking
        expect({ error: result.error, line: result.line }).toMatchSnapshot();
      }
    });
  }

  it('should have found at least one .dsl file', () => {
    expect(allDslFiles.length).toBeGreaterThan(0);
  });
});
