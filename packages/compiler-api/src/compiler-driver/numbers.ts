export function parseNumericLiteral(text: string): number | null {
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

export function parseNumericList(text: string): number[] | null {
  const normalized = text
    .replace(/[{}\[\]\(\)]/g, ' ')
    .split(/[,\s]+/)
    .map((token) => token.trim())
    .filter(Boolean);

  if (normalized.length === 0) return [];

  const values: number[] = [];
  for (const token of normalized) {
    const value = parseNumericLiteral(token);
    if (value === null) return null;
    values.push(value);
  }

  return values;
}
