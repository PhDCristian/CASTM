import {
  AstProgram,
  Diagnostic,
  ErrorCodes,
  MemoryRegionInfo,
  makeDiagnostic
} from '@openedge/compiler-ir';
import { parseNumericLiteral } from './numbers.js';

export interface DataSymbolInfo {
  start: number;
  length: number;
  rows?: number;
  cols?: number;
}

export interface DataRegionCollection {
  regions: MemoryRegionInfo[];
  symbolsByName: Map<string, DataSymbolInfo>;
}

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

export function collectDataRegions(ast: AstProgram, diagnostics: Diagnostic[]): DataRegionCollection {
  const regions: MemoryRegionInfo[] = [];
  const symbolsByName = new Map<string, DataSymbolInfo>();
  const directives = ast.kernel?.directives ?? [];
  let nextAddress = 0;

  for (const directive of directives) {
    if (directive.kind !== 'data' && directive.kind !== 'data2d') continue;

    if (symbolsByName.has(directive.name)) {
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Parse.InvalidSyntax,
        'error',
        directive.span,
        `Duplicate data symbol '${directive.name}'.`,
        'Use unique names across .data and .data2d declarations.'
      ));
      continue;
    }

    if (directive.kind === 'data') {
      const parsed = parseDataDirectiveValue(directive.value);
      if (!parsed) {
        diagnostics.push(makeDiagnostic(
          ErrorCodes.Parse.InvalidSyntax,
          'error',
          directive.span,
          `Invalid .data directive for '${directive.name}'.`,
          'Expected .data name { 1, 2, 3 } or .data name 100 { 1, 2, 3 }.'
        ));
        continue;
      }

      const start = parsed.explicitStart ?? nextAddress;
      regions.push({
        name: directive.name,
        start,
        values: parsed.values
      });
      symbolsByName.set(directive.name, {
        start,
        length: parsed.values.length
      });
      nextAddress = Math.max(nextAddress, start + parsed.values.length * 4);
      continue;
    }

    const parsed2d = parseData2dDirectiveValue(directive.value);
    if (!parsed2d) {
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Parse.InvalidSyntax,
        'error',
        directive.span,
        `Invalid .data2d directive for '${directive.name}'.`,
        'Expected .data2d name[rows][cols] { ... } or .data2d name[total].'
      ));
      continue;
    }

    const start = nextAddress;
    regions.push({
      name: directive.name,
      start,
      values: parsed2d.values,
      rows: parsed2d.rows,
      cols: parsed2d.cols
    });
    symbolsByName.set(directive.name, {
      start,
      length: parsed2d.values.length,
      rows: parsed2d.rows,
      cols: parsed2d.cols
    });
    nextAddress = Math.max(nextAddress, start + parsed2d.values.length * 4);
  }

  return { regions, symbolsByName };
}
