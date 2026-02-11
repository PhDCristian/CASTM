import { parseStructuredSource } from '@openedge/compiler-front';
import {
  CompileOptions,
  ParseResult
} from '@openedge/compiler-ir';
import { hasErrors } from './utils.js';

export function parse(source: string, options: CompileOptions = {}): ParseResult {
  const parsed = parseStructuredSource(source);
  const diagnostics = [...parsed.diagnostics];
  return {
    ...parsed,
    success: !hasErrors(diagnostics),
    diagnostics
  };
}
