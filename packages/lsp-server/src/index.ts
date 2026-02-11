import { compile } from '@openedge/compiler-api';
import { CompileOptions, Diagnostic } from '@openedge/compiler-ir';
import { getInstructionSet, getPragmas, getTargetProfile } from '@openedge/lang-spec';

export interface CompletionItem {
  label: string;
  kind: 'opcode' | 'pragma' | 'register';
  detail?: string;
}

function getRegisters(targetProfileId: string): string[] {
  return getTargetProfile(targetProfileId)?.registers ?? [];
}

export function getCompletions(prefix: string, targetProfileId = 'uma-cgra-v1'): CompletionItem[] {
  const needle = prefix.trim().toUpperCase();
  const out: CompletionItem[] = [];

  for (const opcode of getInstructionSet()) {
    if (!needle || opcode.opcode.startsWith(needle)) {
      out.push({
        label: opcode.opcode,
        kind: 'opcode',
        detail: opcode.description
      });
    }
  }

  for (const pragma of getPragmas()) {
    const label = `#pragma ${pragma.name}`;
    if (!needle || label.toUpperCase().includes(needle)) {
      out.push({
        label,
        kind: 'pragma',
        detail: pragma.kind
      });
    }
  }

  for (const reg of getRegisters(targetProfileId)) {
    if (!needle || reg.startsWith(needle)) {
      out.push({
        label: reg,
        kind: 'register'
      });
    }
  }

  return out;
}

export function validateSource(source: string, options: CompileOptions = {}): Diagnostic[] {
  return compile(source, { ...options, emitArtifacts: ['ast'] }).diagnostics;
}
