import {
  CompilerPass,
  Diagnostic,
  runPassPipeline
} from '@castm/compiler-ir';

export interface PipelineStage {
  name: string;
  passes: Array<CompilerPass<any, any>>;
}

export interface PipelineRunResult<T> {
  output: T;
  loweredPasses: string[];
}

export function runStagedPipeline<T>(
  input: T,
  stages: PipelineStage[],
  diagnostics: Diagnostic[]
): PipelineRunResult<unknown> {
  let current: unknown = input;
  const loweredPasses: string[] = [];

  for (const stage of stages) {
    const stageResult = runPassPipeline(current, stage.passes, diagnostics);
    current = stageResult.output;
    loweredPasses.push(
      ...stageResult.loweredPasses.map((pass) => `${stage.name}:${pass}`)
    );
  }

  return {
    output: current,
    loweredPasses
  };
}
