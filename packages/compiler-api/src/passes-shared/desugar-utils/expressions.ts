export function splitAssignment(text: string): { lhs: string; rhs: string } | null {
  let paren = 0;
  let bracket = 0;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') paren++;
    if (ch === ')') paren = Math.max(0, paren - 1);
    if (ch === '[') bracket++;
    if (ch === ']') bracket = Math.max(0, bracket - 1);

    if (ch !== '=' || paren !== 0 || bracket !== 0) continue;

    const prev = text[i - 1] ?? '';
    const next = text[i + 1] ?? '';
    const isComparison = prev === '=' || prev === '!' || prev === '<' || prev === '>' || next === '=';
    if (isComparison) continue;

    return {
      lhs: text.slice(0, i).trim(),
      rhs: text.slice(i + 1).trim()
    };
  }

  return null;
}

export function splitTopLevelBinary(rhs: string): { left: string; op: string; right: string } | null {
  let paren = 0;
  let bracket = 0;
  const operators = ['>>>', '>>', '<<', '**', '~&', '~|', '~^', '+', '-', '*', '&', '|', '^'];

  for (let i = 0; i < rhs.length; i++) {
    const ch = rhs[i];
    if (ch === '(') paren++;
    if (ch === ')') paren = Math.max(0, paren - 1);
    if (ch === '[') bracket++;
    if (ch === ']') bracket = Math.max(0, bracket - 1);

    if (paren !== 0 || bracket !== 0) continue;

    for (const op of operators) {
      if (!rhs.startsWith(op, i)) continue;
      if (op === '-' && i === 0) continue;
      return {
        left: rhs.slice(0, i).trim(),
        op,
        right: rhs.slice(i + op.length).trim()
      };
    }
  }

  return null;
}
