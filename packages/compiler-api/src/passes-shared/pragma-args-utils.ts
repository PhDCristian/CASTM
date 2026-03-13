export function extractPragmaName(text: string): string {
  const match = text.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)\s*\(/);
  return match ? match[1].toLowerCase() : 'unknown';
}

export function extractStatementBody(text: string, name: string): string | null {
  const pattern = new RegExp(`^${name}\\s*\\((.+)\\)\\s*;?\\s*$`, 'i');
  const match = text.trim().match(pattern);
  return match ? match[1].trim() : null;
}

export function isNumericLiteralToken(text: string): boolean {
  const trimmed = text.trim();
  return /^-?\d+$/.test(trimmed) || /^-?0x[0-9a-f]+$/i.test(trimmed);
}

export function isIdentifier(token: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(token.trim());
}

export function parseIntegerLiteral(text: string): number | null {
  const trimmed = text.trim();
  if (/^-?0x[0-9a-f]+$/i.test(trimmed)) {
    const sign = trimmed.startsWith('-') ? -1 : 1;
    const raw = trimmed.startsWith('-') ? trimmed.slice(1) : trimmed;
    return sign * parseInt(raw, 16);
  }
  if (/^-?\d+$/.test(trimmed)) {
    return parseInt(trimmed, 10);
  }
  return null;
}

export function splitPositionalArgs(body: string): string[] | null {
  const parts: string[] = [];
  let start = 0;
  let depth = 0;

  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === '(' || ch === '[' || ch === '{') depth++;
    if (ch === ')' || ch === ']' || ch === '}') depth = Math.max(0, depth - 1);
    if (ch !== ',' || depth !== 0) continue;

    parts.push(body.slice(start, i).trim());
    start = i + 1;
  }

  parts.push(body.slice(start).trim());
  if (parts.some((part) => part.length === 0)) {
    return null;
  }
  return parts;
}

export function parseKeyValueArgs(body: string): Map<string, string> | null {
  const args = new Map<string, string>();
  const entries = splitPositionalArgs(body);
  if (!entries) return null;
  for (const entry of entries) {
    const match = entry.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/);
    if (!match) return null;
    args.set(match[1].toLowerCase(), match[2].trim());
  }
  return args;
}
