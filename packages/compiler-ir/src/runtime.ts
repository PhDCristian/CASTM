import { SourceSpan } from './common.js';

export interface MemoryRegionInfo {
  name?: string;
  start: number;
  values: number[];
  rows?: number;
  cols?: number;
}

export interface IoConfigInfo {
  loadAddrs: number[];
  storeAddrs: number[];
}

export interface AssertionInfo {
  cycle?: number;
  row?: number;
  col?: number;
  register?: string;
  value?: number;
  raw: string;
  span: SourceSpan;
}

export interface SymbolArrayInfo {
  name: string;
  start: number;
  length: number;
  rows?: number;
  cols?: number;
}

export interface SymbolInfo {
  constants: Record<string, string>;
  aliases: Record<string, string>;
  arrays: SymbolArrayInfo[];
  labels: Record<string, number>;
}
