export interface FrontToken {
  type: 'keyword' | 'identifier' | 'number' | 'string' | 'operator' | 'directive' | 'pragma' | 'symbol';
  value: string;
  line: number;
  column: number;
}

const TOKEN_RE = /#pragma|\.\w+|"(?:\\.|[^"])*"|0x[0-9a-fA-F]+|-?\d+|[A-Za-z_][A-Za-z0-9_]*|==|!=|<=|>=|->|[{}()\[\],:;|=+\-*/%&^@]/g;

export function tokenizeSource(source: string): FrontToken[] {
  const tokens: FrontToken[] = [];
  const lines = source.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].replace(/\/\/.*$/, '');
    let m: RegExpExecArray | null;
    TOKEN_RE.lastIndex = 0;
    while ((m = TOKEN_RE.exec(raw)) !== null) {
      const value = m[0];
      const column = m.index + 1;
      let type: FrontToken['type'] = 'symbol';
      if (value === '#pragma') type = 'pragma';
      else if (value.startsWith('.')) type = 'directive';
      else if (/^"/.test(value)) type = 'string';
      else if (/^-?\d+$/.test(value) || /^0x/.test(value)) type = 'number';
      else if (/^[A-Za-z_]/.test(value)) type = 'identifier';
      else if (/^(==|!=|<=|>=|->|=|\+|-|\*|\/|%|&|\^|\|)$/.test(value)) type = 'operator';
      tokens.push({ type, value, line: i + 1, column });
    }
  }

  return tokens;
}
