import instructionSet from './instruction-set.json' with { type: 'json' };
import pragmaSet from './pragmas.json' with { type: 'json' };
import targetProfiles from './target-profiles.json' with { type: 'json' };

export type Topology = 'torus' | 'mesh';
export type WrapPolicy = 'wrap' | 'clamp';

export interface InstructionSpec {
  opcode: string;
  category: 'control' | 'alu' | 'logic' | 'shift' | 'memory' | 'branch';
  operands: string[];
  description: string;
}

export interface PragmaSpec {
  name: string;
  kind: 'loop' | 'codegen';
}

export interface TargetProfileSpec {
  id: string;
  description: string;
  grid: {
    rows: number;
    cols: number;
    topology: Topology;
    wrapPolicy: WrapPolicy;
  };
  registers: string[];
  neighbors: string[];
}

const INSTRUCTIONS = instructionSet as InstructionSpec[];
const PRAGMAS = pragmaSet as PragmaSpec[];
const TARGETS = targetProfiles as TargetProfileSpec[];
const TARGET_ALIASES: Record<string, string> = {
  base: 'uma-cgra-base',
  mesh: 'uma-cgra-mesh'
};

export function getInstructionSet(): InstructionSpec[] {
  return INSTRUCTIONS.map((x) => ({ ...x, operands: [...x.operands] }));
}

export function getPragmas(): PragmaSpec[] {
  return PRAGMAS.map((x) => ({ ...x }));
}

export function getTargetProfiles(): TargetProfileSpec[] {
  return TARGETS.map((x) => ({
    ...x,
    registers: [...x.registers],
    neighbors: [...x.neighbors],
    grid: { ...x.grid }
  }));
}

export function getTargetProfile(id: string): TargetProfileSpec | null {
  const found = TARGETS.find((x) => x.id === id);
  if (!found) return null;
  return {
    ...found,
    registers: [...found.registers],
    neighbors: [...found.neighbors],
    grid: { ...found.grid }
  };
}

export function resolveTargetProfileId(raw: string): string | null {
  const normalized = raw.trim();
  if (!normalized) return null;
  const direct = TARGETS.find((x) => x.id === normalized);
  if (direct) return direct.id;

  const byAlias = TARGET_ALIASES[normalized.toLowerCase()];
  if (!byAlias) return null;
  return TARGETS.some((x) => x.id === byAlias) ? byAlias : null;
}

export function isOpcode(opcode: string): boolean {
  return INSTRUCTIONS.some((x) => x.opcode === opcode.toUpperCase());
}

export function isRegister(register: string, profileId: string): boolean {
  const profile = getTargetProfile(profileId);
  if (!profile) return false;
  return profile.registers.includes(register.toUpperCase());
}

export function generateInstructionReferenceMarkdown(): string {
  const lines: string[] = [];
  lines.push('# CASTM Instruction Reference');
  lines.push('');
  lines.push('| Opcode | Category | Operands | Description |');
  lines.push('|---|---|---|---|');

  for (const inst of INSTRUCTIONS) {
    lines.push(`| \`${inst.opcode}\` | ${inst.category} | ${inst.operands.join(', ') || '-'} | ${inst.description} |`);
  }

  lines.push('');
  lines.push('## Target Profiles');
  lines.push('');
  for (const target of TARGETS) {
    lines.push(`- \`${target.id}\`: ${target.description} (${target.grid.rows}x${target.grid.cols}, ${target.grid.topology})`);
  }

  return lines.join('\n');
}
