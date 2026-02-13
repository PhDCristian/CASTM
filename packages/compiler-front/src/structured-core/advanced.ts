import { ADVANCED_NAMES } from './constants.js';

export type AdvancedSourceForm = 'qualified' | 'unqualified';

export interface ParsedAdvancedCall {
  name: string;
  args: string;
  text: string;
  sourceForm: AdvancedSourceForm;
  namespace: 'std' | null;
}

export interface AdvancedNamespaceIssue {
  namespace: string;
  name: string;
  text: string;
}

export function parseAdvancedNamespaceIssue(cleanLine: string): AdvancedNamespaceIssue | null {
  const match = cleanLine.match(
    /^([A-Za-z_][A-Za-z0-9_]*)::([A-Za-z_][A-Za-z0-9_]*)\s*\(([\s\S]*)\)\s*;?\s*$/
  );
  if (!match) return null;

  const namespace = match[1].trim();
  const name = match[2].trim().toLowerCase();
  const args = match[3].trim();
  if (!ADVANCED_NAMES.has(name)) return null;
  if (namespace.toLowerCase() === 'std') return null;

  return {
    namespace,
    name,
    text: `${namespace}::${name}(${args})`
  };
}

export function parseStandardAdvancedCall(cleanLine: string): ParsedAdvancedCall | null {
  const qualified = cleanLine.match(
    /^std::([A-Za-z_][A-Za-z0-9_]*)\s*\(([\s\S]*)\)\s*;?\s*$/i
  );
  if (qualified) {
    const name = qualified[1].trim().toLowerCase();
    if (!ADVANCED_NAMES.has(name)) return null;
    const args = qualified[2].trim();
    return {
      name,
      args,
      text: `${name}(${args})`,
      sourceForm: 'qualified',
      namespace: 'std'
    };
  }

  const unqualified = cleanLine.match(
    /^([A-Za-z_][A-Za-z0-9_]*)\s*\(([\s\S]*)\)\s*;?\s*$/
  );
  if (!unqualified) return null;

  const name = unqualified[1].trim().toLowerCase();
  if (!ADVANCED_NAMES.has(name)) return null;
  const args = unqualified[2].trim();
  return {
    name,
    args,
    text: `${name}(${args})`,
    sourceForm: 'unqualified',
    namespace: null
  };
}
