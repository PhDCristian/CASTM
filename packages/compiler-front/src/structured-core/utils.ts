import {
  AstProgram,
  SourceSpan
} from '@castm/compiler-ir';

export function cloneAstProgram(ast: AstProgram): AstProgram {
  return JSON.parse(JSON.stringify(ast)) as AstProgram;
}

export function spanAt(line: number, cleanLength: number): SourceSpan {
  return {
    startLine: line,
    startColumn: 1,
    endLine: line,
    endColumn: Math.max(2, cleanLength + 1)
  };
}

export function parseInteger(text: string): number | null {
  const trimmed = text.trim();
  if (/^-?\d+$/.test(trimmed)) return parseInt(trimmed, 10);
  if (/^0x[0-9a-f]+$/i.test(trimmed)) return parseInt(trimmed, 16);
  return null;
}

export function isElseOpenLine(cleanLine: string): boolean {
  return /^else\s*\{\s*$/i.test(cleanLine);
}
