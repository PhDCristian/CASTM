import {
  AstProgram,
  Diagnostic,
  ErrorCodes,
  MemoryRegionInfo,
  makeDiagnostic
} from '@castm/compiler-ir';
import { DataRegionCollection, DataSymbolInfo } from './types.js';
import {
  parseData2dDirectiveValue,
  parseDataDirectiveValue
} from './parse.js';

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
        'Use unique names across let array declarations.'
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
          `Invalid let array declaration for '${directive.name}'.`,
          `Expected let ${directive.name} = { 1, 2, 3 } or let ${directive.name} @100 = { 1, 2, 3 }.`
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
        `Invalid let matrix declaration for '${directive.name}'.`,
        `Expected let ${directive.name}[rows][cols] = { ... } or let ${directive.name}[total].`
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
