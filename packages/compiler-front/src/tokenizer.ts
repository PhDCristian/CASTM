export interface FrontToken {
  type: 'keyword' | 'identifier' | 'number' | 'string' | 'operator' | 'symbol';
  value: string;
  line: number;
  column: number;
}

const TOKEN_RE = /"(?:\\.|[^"])*"|0x[0-9a-fA-F]+|-?\d+|[A-Za-z_][A-Za-z0-9_]*|==|!=|<=|>=|->|[{}()\[\],:;|=+\-*/%&^@]/g;
const KEYWORDS = new Set([
  'target', 'build', 'kernel', 'config', 'cycle', 'bundle',
  'let', 'at', 'row', 'col', 'all',
  'if', 'else', 'while', 'for', 'break', 'continue', 'in', 'range', 'runtime', 'pipeline',
  'optimize', 'scheduler', 'scheduler_window', 'memory_reorder', 'prune_noop_cycles', 'grid',
  'io', 'load', 'store', 'limit', 'assert',
  'function'
]);
const ADVANCED_STATEMENTS = new Set([
  'route', 'broadcast', 'accumulate', 'mulacc_chain', 'carry_chain', 'conditional_sub', 'collect', 'extract_bytes', 'normalize', 'rotate', 'shift', 'scan', 'reduce',
  'stencil', 'guard', 'triangle', 'allreduce', 'transpose', 'gather', 'stream_load', 'stream_store', 'stash', 'latency_hide'
]);

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
      if (/^"/.test(value)) type = 'string';
      else if (/^-?\d+$/.test(value) || /^0x/.test(value)) type = 'number';
      else if (/^[A-Za-z_]/.test(value)) {
        const normalized = value.toLowerCase();
        if (KEYWORDS.has(normalized) || ADVANCED_STATEMENTS.has(normalized)) {
          type = 'keyword';
        } else {
          type = 'identifier';
        }
      }
      else if (/^(==|!=|<=|>=|->|=|\+|-|\*|\/|%|&|\^|\|)$/.test(value)) type = 'operator';
      tokens.push({ type, value, line: i + 1, column });
    }
  }

  return tokens;
}
