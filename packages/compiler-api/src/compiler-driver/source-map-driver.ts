import {
  AnalysisResult,
  CompileOptions,
  Diagnostic,
  EmitOptions,
  EmitResult,
  ParseResult
} from '@castm/compiler-ir';
import { analyze } from './analyze-driver.js';
import { emit } from './emit-driver.js';
import { parse } from './parse-driver.js';
import { hasErrors } from './utils.js';

export interface CastmCompileArtifacts {
  success: boolean;
  sourceHash: string;
  compilerVersion: string;
  parseResult: ParseResult;
  analysisResult?: AnalysisResult;
  emitResult?: EmitResult;
  diagnostics: Diagnostic[];
}

export function hashCastmSource(source: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < source.length; i++) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function compileWithSourceMap(
  source: string,
  compileOptions: CompileOptions = {},
  emitOptions: EmitOptions = { format: 'sim-matrix-csv' }
): CastmCompileArtifacts {
  const parseResult = parse(source, compileOptions);
  const diagnostics: Diagnostic[] = [...parseResult.diagnostics];

  if (!parseResult.ast || hasErrors(diagnostics)) {
    return {
      success: !hasErrors(diagnostics),
      sourceHash: hashCastmSource(source),
      compilerVersion: '2.0.0-alpha.1',
      parseResult,
      diagnostics
    };
  }

  const analysisResult = analyze({
    ast: parseResult.ast,
    structuredAst: parseResult.structuredAst
  }, compileOptions);
  diagnostics.push(...analysisResult.diagnostics);

  if (!analysisResult.success || hasErrors(diagnostics)) {
    return {
      success: false,
      sourceHash: hashCastmSource(source),
      compilerVersion: '2.0.0-alpha.1',
      parseResult,
      analysisResult,
      diagnostics
    };
  }

  const lowered = analysisResult.lir ?? analysisResult.mir;
  const emitResult = lowered
    ? emit(lowered, { format: 'sim-matrix-csv', ...emitOptions })
    : undefined;

  if (emitResult) {
    diagnostics.push(...emitResult.diagnostics);
  }

  return {
    success: !hasErrors(diagnostics) && (emitResult?.success ?? false),
    sourceHash: hashCastmSource(source),
    compilerVersion: '2.0.0-alpha.1',
    parseResult,
    analysisResult,
    emitResult,
    diagnostics
  };
}
