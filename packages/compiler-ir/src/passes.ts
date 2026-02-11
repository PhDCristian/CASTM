import { Diagnostic } from './common.js';

export interface PassContext {
  diagnostics: Diagnostic[];
}

export interface PassResult<T> {
  output: T;
  diagnostics?: Diagnostic[];
}

export interface CompilerPass<I, O> {
  name: string;
  run(input: I, ctx: PassContext): PassResult<O>;
}

export function runPassPipeline<T>(
  input: T,
  passes: Array<CompilerPass<any, any>>,
  diagnostics: Diagnostic[]
): { output: unknown; loweredPasses: string[]; diagnostics: Diagnostic[] } {
  let current: unknown = input;
  const loweredPasses: string[] = [];

  for (const pass of passes) {
    const result = pass.run(current, { diagnostics });
    current = result.output;
    if (result.diagnostics && result.diagnostics.length > 0) {
      diagnostics.push(...result.diagnostics);
    }
    loweredPasses.push(pass.name);
  }

  return { output: current, loweredPasses, diagnostics };
}
