import { Diagnostic } from '@castm/compiler-ir';
import { bindFunctionCallArgs } from '../functions.js';
import {
  FunctionDefinitionLike
} from '../for-expand.js';
import { SourceLineEntry } from '../../parser-utils/blocks.js';
import { escapeRegExp } from '../../parser-utils/strings.js';
import { INTERPOLATED_IDENT } from '../../constants.js';

function applyFunctionArgs(input: string, argsByParam: ReadonlyMap<string, string>): string {
  let out = input;
  for (const [name, value] of argsByParam.entries()) {
    const regex = new RegExp(`\\b${escapeRegExp(name)}\\b`, 'g');
    out = out.replace(regex, value);
  }
  return out;
}

export function instantiateFunctionBody(
  def: FunctionDefinitionLike,
  args: string[],
  callLineNo: number,
  diagnostics: Diagnostic[],
  expansionCounter: { value: number }
): SourceLineEntry[] | null {
  const argsByParam = bindFunctionCallArgs(def, args, callLineNo, diagnostics);
  if (!argsByParam) return null;

  const expansionId = expansionCounter.value++;

  // For macros, skip label renaming — macros use pure textual substitution.
  // Labels are expected to be unique via parameters or label interpolation.
  if (def.isMacro) {
    return def.body.map((entry) => ({
      lineNo: callLineNo,
      rawLine: applyFunctionArgs(entry.rawLine, argsByParam),
      cleanLine: applyFunctionArgs(entry.cleanLine, argsByParam)
    }));
  }

  const labelMap = new Map<string, string>();
  const labelPattern = new RegExp(`^(${INTERPOLATED_IDENT})\\s*:\\s*(?:cycle|bundle)\\b`, 'i');
  for (const entry of def.body) {
    const match = entry.cleanLine.match(labelPattern);
    if (!match) continue;
    const original = match[1];
    if (!labelMap.has(original)) {
      labelMap.set(original, `__fn_${def.name}_${expansionId}_${original}`);
    }
  }

  return def.body.map((entry) => {
    let raw = applyFunctionArgs(entry.rawLine, argsByParam);
    let clean = applyFunctionArgs(entry.cleanLine, argsByParam);

    for (const [original, renamed] of labelMap.entries()) {
      const regex = new RegExp(`\\b${escapeRegExp(original)}\\b`, 'g');
      raw = raw.replace(regex, renamed);
      clean = clean.replace(regex, renamed);
    }

    return {
      lineNo: callLineNo,
      rawLine: raw,
      cleanLine: clean
    };
  });
}
