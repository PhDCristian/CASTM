import {
  Diagnostic,
  GridSpec
} from '@castm/compiler-ir';
import type { CastmCompileArtifacts } from './compiler-driver/source-map-driver.js';

export interface CastmMatrixCell {
  row: number;
  col: number;
  instruction: string;
}

export interface CastmBundleMatrix {
  bundle: number;
  label?: string;
  grid: GridSpec;
  cells: CastmMatrixCell[];
}

export interface CastmLineRange {
  startLineNumber: number;
  endLineNumber: number;
}

export type CastmVisualPatch =
  | { kind: 'replace-slot'; bundle: number; row: number; col: number; instruction: string }
  | { kind: 'move-slot'; from: { bundle: number; row: number; col: number }; to: { bundle: number; row: number; col: number }; instruction?: string }
  | { kind: 'clear-slot'; bundle: number; row: number; col: number }
  | { kind: 'replace-region'; bundle: number; cells: CastmMatrixCell[] };

export type CastmPatchResult =
  | { status: 'applied'; updatedSource: string; updatedArtifacts: CastmCompileArtifacts; previewDiff: string; sourceHash: string; changedLineRanges: CastmLineRange[] }
  | { status: 'preview'; updatedSource: string; previewDiff: string; sourceHash: string; changedLineRanges: CastmLineRange[] }
  | { status: 'materializationRequired'; previewSource: string; previewDiff: string; diagnostics: Diagnostic[]; changedLineRanges: CastmLineRange[] }
  | { status: 'staleArtifacts'; diagnostics: Diagnostic[] }
  | { status: 'verificationFailed'; diagnostics: Diagnostic[] }
  | { status: 'conflict'; diagnostics: Diagnostic[] }
  | { status: 'invalid'; diagnostics: Diagnostic[] };

export interface ApplyVisualPatchOptions {
  expectedSourceHash?: string;
  previewOnly?: boolean;
}
