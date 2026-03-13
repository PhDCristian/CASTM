import { compile } from '@castm/compiler-api';
import { CompileOptions, Diagnostic } from '@castm/compiler-ir';
import { getInstructionSet, getPragmas, getTargetProfile } from '@castm/lang-spec';

export interface CompletionItem {
  label: string;
  kind: 'opcode' | 'advanced' | 'register' | 'keyword';
  detail?: string;
}

function getRegisters(targetProfileId: string): string[] {
  return getTargetProfile(targetProfileId)?.registers ?? [];
}

export function getCompletions(prefix: string, targetProfileId = 'uma-cgra-base'): CompletionItem[] {
  const needle = prefix.trim().toUpperCase();
  const out: CompletionItem[] = [];

  const keywords = ['let', 'target', 'kernel', 'cycle', 'at', 'if', 'else', 'while', 'for', 'break', 'continue', 'range', 'runtime', 'pipeline'];
  const advancedStatements = getPragmas().flatMap((pragma) => [
    {
      label: `std::${pragma.name}(...);`,
      detail: 'standard advanced statement',
      canonical: true
    },
    {
      label: `${pragma.name}(...);`,
      detail: 'compatibility form (deprecated)',
      canonical: false
    }
  ]);

  for (const keyword of keywords) {
    if (!needle || keyword.toUpperCase().startsWith(needle)) {
      out.push({
        label: keyword,
        kind: 'keyword'
      });
    }
  }

  for (const opcode of getInstructionSet()) {
    if (!needle || opcode.opcode.startsWith(needle)) {
      out.push({
        label: opcode.opcode,
        kind: 'opcode',
        detail: opcode.description
      });
    }
  }

  for (const statement of advancedStatements) {
    if (!needle || statement.label.toUpperCase().includes(needle)) {
      out.push({
        label: statement.label,
        kind: 'advanced',
        detail: statement.detail
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
