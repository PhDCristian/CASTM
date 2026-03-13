import { DeclarationAst, spanAt } from '@castm/compiler-ir';

export function parseDirective(clean: string, line: number): DeclarationAst | null {
  const letData2d = clean.match(
    /^let\s+([A-Za-z_][A-Za-z0-9_]*)\s*\[\s*([^\]]+)\s*\]\s*\[\s*([^\]]+)\s*\]\s*(?:=\s*\{([\s\S]*)\})?\s*;?\s*$/i
  );
  if (letData2d) {
    const name = letData2d[1];
    const rows = letData2d[2].trim();
    const cols = letData2d[3].trim();
    const values = letData2d[4]?.trim();
    return {
      kind: 'data2d',
      name,
      value: values !== undefined ? `[${rows}][${cols}] { ${values} }` : `[${rows}][${cols}]`,
      span: spanAt(line, 1, clean.length)
    };
  }

  const letData1dAs2d = clean.match(
    /^let\s+([A-Za-z_][A-Za-z0-9_]*)\s*\[\s*([^\]]+)\s*\](?:\s*=\s*\{([\s\S]*)\})?\s*;?\s*$/i
  );
  if (letData1dAs2d) {
    const name = letData1dAs2d[1];
    const total = letData1dAs2d[2].trim();
    const values = letData1dAs2d[3]?.trim();
    return {
      kind: 'data2d',
      name,
      value: values !== undefined ? `[${total}] { ${values} }` : `[${total}]`,
      span: spanAt(line, 1, clean.length)
    };
  }

  const letFixedData = clean.match(
    /^let\s+([A-Za-z_][A-Za-z0-9_]*)\s*@\s*([^=;]+?)\s*=\s*\{([\s\S]*)\}\s*;?\s*$/i
  );
  if (letFixedData) {
    return {
      kind: 'data',
      name: letFixedData[1],
      value: `${letFixedData[2].trim()} { ${letFixedData[3].trim()} }`,
      span: spanAt(line, 1, clean.length)
    };
  }

  const letData = clean.match(/^let\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*\{([\s\S]*)\}\s*;?\s*$/i);
  if (letData) {
    return {
      kind: 'data',
      name: letData[1],
      value: `{ ${letData[2].trim()} }`,
      span: spanAt(line, 1, clean.length)
    };
  }

  const letAssign = clean.match(/^let\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+?)\s*;?\s*$/i);
  if (letAssign) {
    const name = letAssign[1];
    const value = letAssign[2].trim();
    if (/^(?:R\d+|ROUT|ZERO|RC[A-Z]+)$/i.test(value)) {
      return {
        kind: 'alias',
        name,
        value,
        span: spanAt(line, 1, clean.length)
      };
    }
    return {
      kind: 'const',
      name,
      value,
      span: spanAt(line, 1, clean.length)
    };
  }

  return null;
}
