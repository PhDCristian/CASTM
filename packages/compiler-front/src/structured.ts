import { parseSource } from './parser.js';
import {
  AstProgram,
  Diagnostic,
  ParseResult,
  StructuredProgramAst
} from '@openedge/compiler-ir';
import { lowerStructuredProgramToAst, toStructuredProgramAst } from './structured-core/conversion.js';
import { parseStructuredProgramFromSource } from './structured-core/parse-source.js';

export {
  lowerStructuredProgramToAst,
  parseStructuredProgramFromSource,
  toStructuredProgramAst
};

export interface StructuredParseResult extends ParseResult {
  structuredAst?: StructuredProgramAst;
  ast?: AstProgram;
  diagnostics: Diagnostic[];
}

export function parseStructuredSource(source: string): StructuredParseResult {
  const parsed = parseSource(source);
  const structuredAst = parseStructuredProgramFromSource(source);

  return {
    ...parsed,
    structuredAst,
    ast: parsed.ast
  };
}
