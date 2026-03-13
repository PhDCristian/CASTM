import { MemoryRegionInfo } from '@castm/compiler-ir';

export interface DataSymbolInfo {
  start: number;
  length: number;
  rows?: number;
  cols?: number;
}

export interface DataRegionCollection {
  regions: MemoryRegionInfo[];
  symbolsByName: Map<string, DataSymbolInfo>;
}
