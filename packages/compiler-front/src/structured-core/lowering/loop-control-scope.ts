export interface LoopControlScope {
  kind: 'while' | 'for-runtime' | 'for-static';
  label?: string;
  breakLabel: string;
  continueLabel: string;
  row: number;
  col: number;
  supportsBreakContinue: boolean;
}
