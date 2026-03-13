import { describe, expect, it } from 'vitest';
import { compile } from '@castm/compiler-api';
import { ErrorCodes, WarningCodes } from '@castm/compiler-ir';

describe('issues/std-advanced-namespace', () => {
  it('accepts std:: qualified advanced statements as canonical form', () => {
    const source = `
target "uma-cgra-base";
kernel "std_route" {
  std::route(@0,1 -> @0,0, payload=R3, accum=R1);
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);
    expect(result.diagnostics.some((d) => d.code === WarningCodes.Style.UnqualifiedStdBuiltin)).toBe(false);
    expect(result.artifacts.csv).toContain('SADD ROUT R3 ZERO');
  });

  it('keeps unqualified advanced statements as compatibility form with migration warning', () => {
    const source = `
target "uma-cgra-base";
kernel "compat_route" {
  route(@0,1 -> @0,0, payload=R3, accum=R1);
}
`;

    const result = compile(source);
    expect(result.success).toBe(true);
    expect(result.diagnostics.some((d) =>
      d.code === WarningCodes.Style.UnqualifiedStdBuiltin
      && d.severity === 'warning'
      && d.hintCode === 'MIG-STD-001'
    )).toBe(true);
  });

  it('rejects non-std namespaces for standard advanced statements', () => {
    const source = `
target "uma-cgra-base";
kernel "bad_ns_route" {
  foo::route(@0,1 -> @0,0, payload=R3, accum=R1);
}
`;

    const result = compile(source);
    expect(result.success).toBe(false);
    expect(result.diagnostics.some((d) =>
      d.code === ErrorCodes.Parse.InvalidSyntax
      && d.message.includes('Unsupported advanced namespace')
    )).toBe(true);
  });
});
