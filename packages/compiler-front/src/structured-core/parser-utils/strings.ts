export function splitTopLevel(input: string, delimiter: string): string[] {
  const out: string[] = [];
  let current = '';
  let paren = 0;
  let bracket = 0;
  let brace = 0;

  for (const ch of input) {
    if (ch === '(') paren++;
    if (ch === ')') paren = Math.max(0, paren - 1);
    if (ch === '[') bracket++;
    if (ch === ']') bracket = Math.max(0, bracket - 1);
    if (ch === '{') brace++;
    if (ch === '}') brace = Math.max(0, brace - 1);

    if (ch === delimiter && paren === 0 && bracket === 0 && brace === 0) {
      out.push(current.trim());
      current = '';
      continue;
    }

    current += ch;
  }

  if (current.trim().length > 0) out.push(current.trim());
  return out;
}

export function stripLineComment(line: string): string {
  return line.replace(/\/\/.*$/, '');
}

export function countChar(text: string, needle: string): number {
  let count = 0;
  for (const ch of text) {
    if (ch === needle) count++;
  }
  return count;
}

export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
