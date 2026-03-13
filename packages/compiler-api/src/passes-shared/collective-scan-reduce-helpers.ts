export function getScanIncomingRegister(direction: 'left' | 'right' | 'up' | 'down'): string {
  switch (direction) {
    case 'right':
      return 'RCL';
    case 'left':
      return 'RCR';
    case 'down':
      return 'RCT';
    case 'up':
      return 'RCB';
  }
}

export function getScanIdentity(operation: string): string {
  switch (operation) {
    case 'add':
    case 'or':
    case 'xor':
      return '0';
    case 'and':
      return '4294967295';
    case 'max':
      return '-2147483648';
    case 'min':
      return '2147483647';
    default:
      return '0';
  }
}

export function getScanOpcode(operation: string): string | null {
  switch (operation) {
    case 'add':
      return 'SADD';
    case 'and':
      return 'LAND';
    case 'or':
      return 'LOR';
    case 'xor':
      return 'LXOR';
    default:
      return null;
  }
}

export function getReduceOpcode(operation: string): string | null {
  switch (operation) {
    case 'sum':
    case 'add':
      return 'SADD';
    case 'and':
      return 'LAND';
    case 'or':
      return 'LOR';
    case 'xor':
      return 'LXOR';
    case 'mul':
      return 'SMUL';
    default:
      return null;
  }
}

export function pickScratchRegisters(excludes: string[]): [string, string] | null {
  // Match uma-cgra-base target profile register file (R0..R3 only).
  const candidates = ['R3', 'R2', 'R1', 'R0'];
  const excludeSet = new Set(excludes.map((reg) => reg.toUpperCase()));
  const filtered = candidates.filter((reg) => !excludeSet.has(reg));
  if (filtered.length < 2) return null;
  return [filtered[0], filtered[1]];
}
