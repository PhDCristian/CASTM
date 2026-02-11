import {
  AssertionInfo,
  IoConfigInfo,
  SourceSpan,
  SymbolInfo
} from '@openedge/compiler-ir';

export interface RuntimeArtifactCollection {
  ioConfig: IoConfigInfo;
  cycleLimit?: number;
  cycleLimitSpan?: SourceSpan;
  assertions: AssertionInfo[];
  symbols: SymbolInfo;
}
