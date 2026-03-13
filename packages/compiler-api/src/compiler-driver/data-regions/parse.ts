import { parseNumericLiteral } from '../numbers.js';

export function parseDataDirectiveValue(rawValue: string): { explicitStart?: number; values: number[] } | null {
  const trimmed = rawValue.trim();
  const explicitAddressMatch = trimmed.match(/^(-?0x[0-9a-f]+|-?\d+)\s*\{([\s\S]*)\}$/i);

  let explicitStart: number | undefined;
  let valuesBody = '';

  if (explicitAddressMatch) {
    const parsedStart = parseNumericLiteral(explicitAddressMatch[1]);
    if (parsedStart === null) return null;
    explicitStart = parsedStart;
    valuesBody = explicitAddressMatch[2].trim();
  } else {
    const bodyMatch = trimmed.match(/^\{([\s\S]*)\}$/);
    if (!bodyMatch) return null;
    valuesBody = bodyMatch[1].trim();
  }

  if (valuesBody.length === 0) {
    return { explicitStart, values: [] };
  }

  const values: number[] = [];
  for (const token of valuesBody.split(',')) {
    const parsed = parseNumericLiteral(token);
    if (parsed === null) return null;
    values.push(parsed);
  }

  return { explicitStart, values };
}

export function parseData2dDirectiveValue(rawValue: string): { rows: number; cols: number; values: number[] } | null {
  const trimmed = rawValue.trim();
  const match = trimmed.match(/^\[([^\]]+)\]\s*(?:\[([^\]]+)\])?\s*(?:\{([\s\S]*)\})?$/);
  if (!match) return null;

  const dim1 = parseNumericLiteral(match[1].trim());
  if (dim1 === null || !Number.isInteger(dim1) || dim1 <= 0) return null;

  let rows: number;
  let cols: number;
  if (match[2] !== undefined) {
    const dim2 = parseNumericLiteral(match[2].trim());
    if (dim2 === null || !Number.isInteger(dim2) || dim2 <= 0) return null;
    rows = dim1;
    cols = dim2;
  } else {
    const sqrt = Math.sqrt(dim1);
    if (Number.isInteger(sqrt)) {
      rows = sqrt;
      cols = sqrt;
    } else {
      rows = 1;
      cols = dim1;
    }
  }

  const total = rows * cols;
  if (match[3] === undefined) {
    return {
      rows,
      cols,
      values: Array.from({ length: total }, () => 0)
    };
  }

  const body = match[3].trim();
  const values: number[] = [];
  if (body.length > 0) {
    for (const token of body.split(',')) {
      const parsed = parseNumericLiteral(token);
      if (parsed === null) return null;
      values.push(parsed);
    }
  }

  if (values.length !== total) return null;
  return { rows, cols, values };
}
