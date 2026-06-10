import {
  AssertionInfo,
  IoConfigInfo,
  SourceSpan,
  SymbolInfo
} from '@castm/compiler-ir';

export interface RuntimeArtifactCollection {
  ioConfig: IoConfigInfo;
  bundleLimit?: number;
  bundleLimitSpan?: SourceSpan;
  assertions: AssertionInfo[];
  symbols: SymbolInfo;
}
