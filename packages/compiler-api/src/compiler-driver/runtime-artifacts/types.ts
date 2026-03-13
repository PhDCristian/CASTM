import {
  AssertionInfo,
  IoConfigInfo,
  SourceSpan,
  SymbolInfo
} from '@castm/compiler-ir';

export interface RuntimeArtifactCollection {
  ioConfig: IoConfigInfo;
  cycleLimit?: number;
  cycleLimitSpan?: SourceSpan;
  assertions: AssertionInfo[];
  symbols: SymbolInfo;
}
