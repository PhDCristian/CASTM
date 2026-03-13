import {
  AstProgram,
  Diagnostic,
  ErrorCodes,
  InstructionAst,
  SourceSpan,
  makeDiagnostic
} from '@castm/compiler-ir';
import { cloneAst } from '../ast-utils.js';
import { isIdentifier } from '../pragma-args-utils.js';

export function transformInstructions(
  ast: AstProgram,
  transformer: (instruction: InstructionAst, diagnostics: Diagnostic[]) => InstructionAst
): { output: AstProgram; diagnostics: Diagnostic[] } {
  const out = cloneAst(ast);
  if (!out.kernel) return { output: out, diagnostics: [] };

  const diagnostics: Diagnostic[] = [];

  for (const cycle of out.kernel.cycles) {
    for (const stmt of cycle.statements) {
      if (stmt.kind === 'row') {
        stmt.instructions = stmt.instructions.map((inst) => transformer(inst, diagnostics));
        continue;
      }

      stmt.instruction = transformer(stmt.instruction, diagnostics);
    }
  }

  return { output: out, diagnostics };
}

export function requireIdentifier(
  token: string,
  diagnostics: Diagnostic[],
  span: SourceSpan,
  message: string,
  hint: string
): boolean {
  if (isIdentifier(token)) return true;
  diagnostics.push(makeDiagnostic(
    ErrorCodes.Semantic.InvalidAssignment,
    'error',
    span,
    message,
    hint
  ));
  return false;
}
