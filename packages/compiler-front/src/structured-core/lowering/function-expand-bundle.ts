import {
  BundleAst,
  ErrorCodes,
  makeDiagnostic,
  spanAt
} from '@castm/compiler-ir';
import {
  expandLoopBody,
  parseInlineBundleStatements,
  parseLabeledBundleLine
} from './bundle-expand.js';
import { collectBlockFromEntries } from '../parser-utils/blocks.js';
import {
  FunctionExpandStepInput,
  FunctionExpandStepResult
} from './function-expand-types.js';

export function tryExpandBundleStatement(input: FunctionExpandStepInput): FunctionExpandStepResult {
  const {
    body,
    index,
    entry,
    clean,
    kernel,
    constants,
    diagnostics,
    bundleCounter
  } = input;

  const labeledBundle = parseLabeledBundleLine(clean);
  if (labeledBundle && labeledBundle.inlinePayload !== undefined) {
    const bundle: BundleAst = {
      index: bundleCounter.value++,
      label: labeledBundle.label,
      statements: parseInlineBundleStatements(labeledBundle.inlinePayload, entry.lineNo, constants, diagnostics),
      span: spanAt(entry.lineNo, 1, clean.length)
    };
    kernel.bundles.push(bundle);
    return { handled: true, nextIndex: index, shouldBreak: false };
  }

  if (labeledBundle) {
    const block = collectBlockFromEntries(body, index);
    if (block.endIndex === null) {
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Parse.InvalidSyntax,
        'error',
        spanAt(entry.lineNo, 1, clean.length),
        `Unterminated labeled bundle '${labeledBundle.label}' inside function body.`,
        'Add a closing brace for bundle { ... }.'
      ));
      return { handled: true, nextIndex: index, shouldBreak: true };
    }

    kernel.bundles.push({
      index: bundleCounter.value++,
      label: labeledBundle.label,
      statements: expandLoopBody(block.body, constants, new Map(), diagnostics),
      span: spanAt(entry.lineNo, 1, clean.length)
    });
    return { handled: true, nextIndex: block.endIndex, shouldBreak: false };
  }

  const inlineBundleMatch = clean.match(/^bundle\s*\{\s*(.+)\s*\}\s*$/i);
  if (inlineBundleMatch) {
    const bundle: BundleAst = {
      index: bundleCounter.value++,
      statements: parseInlineBundleStatements(inlineBundleMatch[1], entry.lineNo, constants, diagnostics),
      span: spanAt(entry.lineNo, 1, clean.length)
    };
    kernel.bundles.push(bundle);
    return { handled: true, nextIndex: index, shouldBreak: false };
  }

  if (!/^bundle\s*\{\s*$/i.test(clean)) {
    return { handled: false, nextIndex: index, shouldBreak: false };
  }

  const block = collectBlockFromEntries(body, index);
  if (block.endIndex === null) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      spanAt(entry.lineNo, 1, clean.length),
      'Unterminated bundle block inside function body.',
      'Add a closing brace for bundle { ... }.'
    ));
    return { handled: true, nextIndex: index, shouldBreak: true };
  }

  kernel.bundles.push({
    index: bundleCounter.value++,
    statements: expandLoopBody(block.body, constants, new Map(), diagnostics),
    span: spanAt(entry.lineNo, 1, clean.length)
  });
  return { handled: true, nextIndex: block.endIndex, shouldBreak: false };
}
