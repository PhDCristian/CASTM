import {
  BuildConfigAst,
  Diagnostic,
  ErrorCodes,
  makeDiagnostic
} from '@castm/compiler-ir';
import {
  collectBlockFromEntries,
  SourceLineEntry
} from './parser-utils/blocks.js';
import { splitTopLevel } from './parser-utils/strings.js';
import { parseInteger, spanAt } from './utils.js';

export function parseBuildConfig(
  entries: SourceLineEntry[],
  startIndex: number,
  diagnostics: Diagnostic[]
): { config?: BuildConfigAst; endIndex: number | null } {
  const header = entries[startIndex].cleanLine;
  const inlineBuild = header.match(/^build\s*\{([\s\S]*)\}\s*;?\s*$/i);
  let settings: SourceLineEntry[] = [];
  let endIndex: number | null = null;
  if (inlineBuild) {
    settings = splitTopLevel(inlineBuild[1], ';')
      .map((segment) => segment.trim())
      .filter(Boolean)
      .map((cleanLine) => ({
        lineNo: entries[startIndex].lineNo,
        rawLine: entries[startIndex].rawLine,
        cleanLine
      }));
    endIndex = startIndex;
  } else {
    const buildBlock = collectBlockFromEntries(entries, startIndex);
    if (buildBlock.endIndex === null) {
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Parse.InvalidSyntax,
        'error',
        spanAt(entries[startIndex].lineNo, entries[startIndex].cleanLine.length),
        'Unterminated build block.',
        'Add a closing brace for build { ... }.'
      ));
      return { endIndex: null };
    }
    settings = buildBlock.body;
    endIndex = buildBlock.endIndex;
  }

  const config: BuildConfigAst = {
    span: {
      startLine: entries[startIndex].lineNo,
      startColumn: 1,
      endLine: entries[endIndex].lineNo,
      endColumn: Math.max(2, entries[endIndex].cleanLine.length + 1)
    }
  };

  for (const entry of settings) {
    const clean = entry.cleanLine.trim();
    if (!clean) continue;

    const optimize = clean.match(/^optimize\s+(O[0-3])\s*;?\s*$/i);
    if (optimize) {
      config.optimize = optimize[1].toUpperCase() as BuildConfigAst['optimize'];
      continue;
    }

    const scheduler = clean.match(/^scheduler\s+(safe|balanced|aggressive)\s*;?\s*$/i);
    if (scheduler) {
      config.scheduler = scheduler[1].toLowerCase() as BuildConfigAst['scheduler'];
      continue;
    }

    const schedulerWindow = clean.match(/^scheduler_window\s+(auto|-?\d+)\s*;?\s*$/i);
    if (schedulerWindow) {
      const raw = schedulerWindow[1].toLowerCase();
      if (raw === 'auto') {
        config.schedulerWindow = 'auto';
      } else {
        const parsed = parseInteger(raw);
        if (parsed === null || parsed < 0) {
          diagnostics.push(makeDiagnostic(
            ErrorCodes.Parse.InvalidSyntax,
            'error',
            spanAt(entry.lineNo, clean.length),
            `Invalid scheduler_window value '${schedulerWindow[1]}'.`,
            'Use a non-negative integer or auto.'
          ));
        } else {
          config.schedulerWindow = parsed;
        }
      }
      continue;
    }

    const memoryReorder = clean.match(/^memory_reorder\s+(strict|same_address_fence)\s*;?\s*$/i);
    if (memoryReorder) {
      config.memoryReorder = memoryReorder[1].toLowerCase() as BuildConfigAst['memoryReorder'];
      continue;
    }

    const expansionMode = clean.match(/^expansion_mode\s+(full-unroll|jump-reuse)\s*;?\s*$/i);
    if (expansionMode) {
      config.expansionMode = expansionMode[1].toLowerCase() as BuildConfigAst['expansionMode'];
      continue;
    }

    const jumpReuseDepth = clean.match(/^jump_reuse_depth\s+(\d+)\s*;?\s*$/i);
    if (jumpReuseDepth) {
      const parsed = parseInteger(jumpReuseDepth[1]);
      if (parsed === null || parsed < 0 || parsed > 1) {
        diagnostics.push(makeDiagnostic(
          ErrorCodes.Parse.InvalidSyntax,
          'error',
          spanAt(entry.lineNo, clean.length),
          `Invalid jump_reuse_depth value '${jumpReuseDepth[1]}'.`,
          'Use 0 or 1.'
        ));
      } else {
        config.jumpReuseDepth = parsed;
      }
      continue;
    }

    const prune = clean.match(/^prune_noop_cycles\s+(on|off|true|false)\s*;?\s*$/i);
    if (prune) {
      const normalized = prune[1].toLowerCase();
      config.pruneNoopCycles = normalized === 'on' || normalized === 'true';
      continue;
    }

    const grid = clean.match(/^grid\s+(\d+)\s*x\s*(\d+)(?:\s+(torus|mesh))?\s*;?\s*$/i);
    if (grid) {
      const rows = Number.parseInt(grid[1], 10);
      const cols = Number.parseInt(grid[2], 10);
      if (rows <= 0 || cols <= 0) {
        diagnostics.push(makeDiagnostic(
          ErrorCodes.Parse.InvalidSyntax,
          'error',
          spanAt(entry.lineNo, clean.length),
          `Invalid grid dimensions '${grid[1]}x${grid[2]}'.`,
          'Rows and columns must be positive integers.'
        ));
      } else {
        config.grid = {
          rows,
          cols,
          ...(grid[3] ? { topology: grid[3].toLowerCase() as NonNullable<BuildConfigAst['grid']>['topology'] } : {})
        };
      }
      continue;
    }

    diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      spanAt(entry.lineNo, clean.length),
      `Unknown build setting '${clean}'.`,
      'Supported keys: optimize, scheduler, scheduler_window, memory_reorder, expansion_mode, jump_reuse_depth, prune_noop_cycles, grid.'
    ));
  }

  return {
    config,
    endIndex
  };
}
