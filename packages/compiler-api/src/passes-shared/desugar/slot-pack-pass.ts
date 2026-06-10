import {
  AstProgram,
  CompilerPass,
  BundleAst,
  BundleStatementAst,
  GridSpec,
  InstructionAst
} from '@castm/compiler-ir';
import { cloneAst } from '../ast-utils.js';

const CONTROL_OPCODES = new Set([
  'BEQ',
  'BNE',
  'BGT',
  'BGE',
  'BLT',
  'BLE',
  'BRA',
  'JMP',
  'JUMP',
  'EXIT'
]);

const MEMORY_OPCODES = new Set([
  'LWI',
  'SWI',
  'LWD',
  'SWD'
]);

const BRANCH_WITH_NUMERIC_TARGET = new Set([
  'BEQ',
  'BNE',
  'BGT',
  'BGE',
  'BLT',
  'BLE',
  'BRA',
  'JMP',
  'JUMP'
]);

type MemoryReorderPolicy = 'strict' | 'same-address-fence';

export interface SlotPackPassOptions {
  window: number;
  memoryReorderPolicy: MemoryReorderPolicy;
}

interface Placement {
  id: number;
  row: number;
  col: number;
  instruction: InstructionAst;
  span: BundleStatementAst['span'];
  originOrder: number;
  hasControl: boolean;
  hasMemory: boolean;
  memoryAddressKey: string | null;
  routeSensitive: boolean;
  readsIncoming: boolean;
  writesRoute: boolean;
  isNoop: boolean;
}

interface ExpandedPlacement {
  row: number;
  col: number;
  instruction: InstructionAst;
  span: BundleStatementAst['span'];
}

interface BundleBucket {
  label?: string;
  span: BundleAst['span'];
  placements: Placement[];
  barrier: boolean;
}

function normalizeOpcode(instruction: InstructionAst): string {
  if (instruction.opcode) return instruction.opcode.toUpperCase();
  const text = instruction.text.trim();
  const firstSpace = text.indexOf(' ');
  const first = firstSpace === -1 ? text : text.slice(0, firstSpace);
  return first.toUpperCase();
}

function normalizedOperands(instruction: InstructionAst): string[] {
  if (instruction.operands.length > 0) {
    return instruction.operands.map((value) => value.trim()).filter(Boolean);
  }
  const payload = instruction.text
    .trim()
    .replace(/^[A-Za-z_][A-Za-z0-9_]*/, '')
    .trim();
  if (!payload) return [];
  return payload.split(',').map((value) => value.trim()).filter(Boolean);
}

function isNopInstruction(instruction: InstructionAst): boolean {
  const text = instruction.text.trim().toUpperCase();
  return text === 'NOP' || text === '_';
}

function isControlInstruction(instruction: InstructionAst): boolean {
  return CONTROL_OPCODES.has(normalizeOpcode(instruction));
}

function isMemoryInstruction(instruction: InstructionAst): boolean {
  return MEMORY_OPCODES.has(normalizeOpcode(instruction));
}

function readsIncoming(instruction: InstructionAst): boolean {
  const body = `${instruction.operands.join(',')} ${instruction.text}`.toUpperCase();
  return /\b(RCL|RCR|RCT|RCB|INCOMING)\b/.test(body);
}

function writesRoute(instruction: InstructionAst): boolean {
  const operands = normalizedOperands(instruction);
  if (operands.length === 0) return false;
  return operands[0].toUpperCase() === 'ROUT';
}

function isIntegerLiteral(text: string): boolean {
  return /^[-+]?(?:\d+|0x[0-9a-fA-F]+)$/i.test(text.trim());
}

function extractMemoryAddressKey(instruction: InstructionAst): string | null {
  const opcode = normalizeOpcode(instruction);
  if (!MEMORY_OPCODES.has(opcode)) return null;
  const operands = normalizedOperands(instruction);
  const rawAddress = opcode === 'LWD' || opcode === 'SWD'
    ? 'IO_PORT'
    : (operands[1] ?? '');

  if (!rawAddress) return null;
  const compact = rawAddress.replace(/\s+/g, '').toUpperCase();
  if (isIntegerLiteral(compact)) return compact;
  return null;
}

function expandStatement(statement: BundleStatementAst, grid: GridSpec): ExpandedPlacement[] | null {
  if (statement.kind === 'at-expr') return null;

  if (statement.kind === 'at') {
    if (statement.row < 0 || statement.row >= grid.rows) return null;
    if (statement.col < 0 || statement.col >= grid.cols) return null;
    return [{
      row: statement.row,
      col: statement.col,
      instruction: statement.instruction,
      span: statement.span
    }];
  }

  if (statement.kind === 'row') {
    if (statement.row < 0 || statement.row >= grid.rows) return null;
    const placements: ExpandedPlacement[] = [];
    if (statement.instructions.length === 0) {
      return placements;
    }

    const broadcastInstruction = statement.instructions.length === 1
      ? statement.instructions[0]
      : null;

    for (let col = 0; col < grid.cols; col++) {
      const instruction = broadcastInstruction
        ?? statement.instructions[col]
        ?? {
          opcode: 'NOP',
          operands: [],
          text: 'NOP',
          span: statement.span
        };
      placements.push({
        row: statement.row,
        col,
        instruction,
        span: statement.span
      });
    }
    return placements;
  }

  if (statement.kind === 'col') {
    if (statement.col < 0 || statement.col >= grid.cols) return null;
    const placements: ExpandedPlacement[] = [];
    for (let row = 0; row < grid.rows; row++) {
      placements.push({
        row,
        col: statement.col,
        instruction: statement.instruction,
        span: statement.span
      });
    }
    return placements;
  }

  const placements: ExpandedPlacement[] = [];
  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      placements.push({
        row,
        col,
        instruction: statement.instruction,
        span: statement.span
      });
    }
  }
  return placements;
}

function parseIntegerLiteral(text: string): number | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (/^[-+]?\d+$/.test(trimmed)) {
    const value = Number.parseInt(trimmed, 10);
    return Number.isFinite(value) ? value : null;
  }
  if (/^[-+]?0x[0-9a-fA-F]+$/i.test(trimmed)) {
    const negative = trimmed.startsWith('-');
    const unsigned = trimmed.replace(/^[-+]/, '');
    const value = Number.parseInt(unsigned, 16);
    if (!Number.isFinite(value)) return null;
    return negative ? -value : value;
  }
  return null;
}

function formatIntegerLike(original: string, value: number): string {
  const trimmed = original.trim();
  if (/^[-+]?0x[0-9a-fA-F]+$/i.test(trimmed)) {
    if (value < 0) return `-0x${Math.abs(value).toString(16)}`;
    return `0x${value.toString(16)}`;
  }
  return String(value);
}

function resolveRemappedBundleTarget(
  target: number,
  oldToNewBundle: number[],
  newBundleLength: number
): number {
  if (!Number.isFinite(target)) return target;
  if (target < 0) return target;
  if (target >= oldToNewBundle.length) return target;

  for (let index = target; index < oldToNewBundle.length; index++) {
    const mapped = oldToNewBundle[index];
    if (mapped >= 0) return mapped;
  }

  // If the original target was a trailing removed noop bundle, jump to end.
  return newBundleLength;
}

function remapNumericBranchTargets(
  bundles: BundleBucket[],
  oldToNewBundle: number[],
  newBundleLength: number
): void {
  for (const bundle of bundles) {
    for (const placement of bundle.placements) {
      const opcode = normalizeOpcode(placement.instruction);
      if (!BRANCH_WITH_NUMERIC_TARGET.has(opcode)) continue;

      const operands = normalizedOperands(placement.instruction);
      if (operands.length === 0) continue;
      const targetIndex = operands.length - 1;
      const originalTargetToken = operands[targetIndex];
      const target = parseIntegerLiteral(originalTargetToken);
      if (target === null) continue;

      const remappedTarget = resolveRemappedBundleTarget(target, oldToNewBundle, newBundleLength);
      if (remappedTarget === target) continue;

      const nextOperands = operands.slice();
      nextOperands[targetIndex] = formatIntegerLike(originalTargetToken, remappedTarget);
      placement.instruction = {
        ...placement.instruction,
        opcode,
        operands: nextOperands,
        text: `${opcode} ${nextOperands.join(', ')}`
      };
    }
  }
}

function canPlacementMove(
  placement: Placement,
  bundle: BundleBucket,
  policy: MemoryReorderPolicy
): boolean {
  if (bundle.barrier) return false;
  if (placement.isNoop) return false;
  if (placement.hasControl) return false;
  if (placement.readsIncoming) return false;
  if (placement.hasMemory) return false;
  return true;
}

function maxPreviousBundleOnSamePe(
  placement: Placement,
  coordinateMap: Map<string, Placement[]>,
  currentBundleByPlacement: Map<number, number>
): number {
  const key = `${placement.row},${placement.col}`;
  const peers = coordinateMap.get(key) ?? [];
  let maxBundle = -1;
  for (const peer of peers) {
    if (peer.originOrder >= placement.originOrder) break;
    const peerBundle = currentBundleByPlacement.get(peer.id);
    if (peerBundle !== undefined && peerBundle > maxBundle) {
      maxBundle = peerBundle;
    }
  }
  return maxBundle;
}

function canMovePlacementToBundle(
  placement: Placement,
  fromBundle: number,
  toBundle: number,
  bundles: BundleBucket[],
  currentBundleByPlacement: Map<number, number>,
  coordinateMap: Map<string, Placement[]>,
  policy: MemoryReorderPolicy
): boolean {
  if (toBundle < 0 || toBundle >= fromBundle) return false;
  if (bundles[toBundle].barrier) return false;

  for (let bundleIndex = toBundle + 1; bundleIndex < fromBundle; bundleIndex++) {
    if (bundles[bundleIndex].barrier) return false;
  }

  for (const peer of bundles[toBundle].placements) {
    if (peer.row === placement.row && peer.col === placement.col) return false;
  }

  const maxPrevious = maxPreviousBundleOnSamePe(placement, coordinateMap, currentBundleByPlacement);
  if (toBundle <= maxPrevious) return false;

  if (placement.writesRoute) {
    for (let bundleIndex = toBundle; bundleIndex < fromBundle; bundleIndex++) {
      for (const peer of bundles[bundleIndex].placements) {
        if (peer.readsIncoming) return false;
        if (policy === 'strict' && peer.writesRoute) return false;
      }
    }
  }

  return true;
}

function normalizeWindow(window: number): number {
  if (!Number.isFinite(window)) return 0;
  const rounded = Math.floor(window);
  if (rounded < 0) return 0;
  return rounded;
}

export function createSlotPackPass(
  grid: GridSpec,
  options: SlotPackPassOptions
): CompilerPass<AstProgram, AstProgram> {
  const window = normalizeWindow(options.window);
  const policy: MemoryReorderPolicy = options.memoryReorderPolicy;

  return {
    name: 'slot-pack',
    run(input) {
      const output = cloneAst(input);
      if (!output.kernel || window === 0) {
        return { output, diagnostics: [] };
      }

      let placementId = 0;
      let originOrder = 0;
      const bundles: BundleBucket[] = [];
      const allPlacements: Placement[] = [];

      for (const bundle of output.kernel.bundles) {
        const placements: Placement[] = [];
        let hasControl = false;
        let hasRouteSensitive = false;
        let unsupported = false;

        for (const statement of bundle.statements) {
          const expanded = expandStatement(statement, grid);
          if (!expanded) {
            unsupported = true;
            break;
          }
          for (const candidate of expanded) {
            const noop = isNopInstruction(candidate.instruction);
            const control = isControlInstruction(candidate.instruction);
            const memory = isMemoryInstruction(candidate.instruction);
            const readsRouteIncoming = readsIncoming(candidate.instruction);
            const writesRouteOutput = writesRoute(candidate.instruction);
            const routeSensitive = writesRouteOutput || readsRouteIncoming;
            const placement: Placement = {
              id: placementId++,
              row: candidate.row,
              col: candidate.col,
              instruction: candidate.instruction,
              span: candidate.span,
              originOrder: originOrder++,
              hasControl: control,
              hasMemory: memory,
              memoryAddressKey: extractMemoryAddressKey(candidate.instruction),
              routeSensitive,
              readsIncoming: readsRouteIncoming,
              writesRoute: writesRouteOutput,
              isNoop: noop
            };
            hasControl = hasControl || control;
            hasRouteSensitive = hasRouteSensitive || routeSensitive;
            placements.push(placement);
            allPlacements.push(placement);
          }
        }

        if (unsupported) {
          return { output, diagnostics: [] };
        }

        const barrier = Boolean(bundle.label)
          || hasControl;

        bundles.push({
          label: bundle.label,
          span: bundle.span,
          placements,
          barrier
        });
      }

      const coordinateMap = new Map<string, Placement[]>();
      const currentBundleByPlacement = new Map<number, number>();
      for (let bundleIndex = 0; bundleIndex < bundles.length; bundleIndex++) {
        for (const placement of bundles[bundleIndex].placements) {
          const key = `${placement.row},${placement.col}`;
          const list = coordinateMap.get(key) ?? [];
          list.push(placement);
          coordinateMap.set(key, list);
          currentBundleByPlacement.set(placement.id, bundleIndex);
        }
      }
      for (const list of coordinateMap.values()) {
        list.sort((a, b) => a.originOrder - b.originOrder);
      }

      for (let sourceBundle = 0; sourceBundle < bundles.length; sourceBundle++) {
        const sourcePlacements = [...bundles[sourceBundle].placements];
        for (const placement of sourcePlacements) {
          const currentSourceBundle = currentBundleByPlacement.get(placement.id)!;
          if (!canPlacementMove(placement, bundles[currentSourceBundle], policy)) continue;

          const minBundle = Math.max(0, currentSourceBundle - window);
          let moved = false;
          for (let targetBundle = minBundle; targetBundle < currentSourceBundle; targetBundle++) {
            if (!canMovePlacementToBundle(
              placement,
              currentSourceBundle,
              targetBundle,
              bundles,
              currentBundleByPlacement,
              coordinateMap,
              policy
            )) {
              continue;
            }

            const originBucket = bundles[currentSourceBundle];
            const originIndex = originBucket.placements.findIndex((item) => item.id === placement.id);
            originBucket.placements.splice(originIndex, 1);
            bundles[targetBundle].placements.push(placement);
            currentBundleByPlacement.set(placement.id, targetBundle);
            moved = true;
            break;
          }

          if (!moved) continue;
        }
      }

      for (const bundle of bundles) {
        bundle.placements.sort((a, b) => a.originOrder - b.originOrder);
      }

      const bundleRetained = bundles.map((bundle) => bundle.placements.length > 0 || Boolean(bundle.label));
      const oldToNewBundle = new Array<number>(bundles.length).fill(-1);
      let newBundleLength = 0;
      for (let index = 0; index < bundles.length; index++) {
        if (!bundleRetained[index]) continue;
        oldToNewBundle[index] = newBundleLength++;
      }
      remapNumericBranchTargets(bundles, oldToNewBundle, newBundleLength);

      const rebuiltBundles: BundleAst[] = [];
      for (let oldIndex = 0; oldIndex < bundles.length; oldIndex++) {
        const bundle = bundles[oldIndex];
        if (!bundleRetained[oldIndex]) {
          continue;
        }

        rebuiltBundles.push({
          index: rebuiltBundles.length,
          label: bundle.label,
          span: bundle.span,
          statements: bundle.placements.map((placement) => ({
            kind: 'at' as const,
            row: placement.row,
            col: placement.col,
            instruction: placement.instruction,
            span: placement.span
          }))
        });
      }

      output.kernel.bundles = rebuiltBundles;
      return { output, diagnostics: [] };
    }
  };
}

export const __slotPackTestUtils = {
  normalizeOpcode,
  normalizedOperands,
  extractMemoryAddressKey,
  expandStatement,
  parseIntegerLiteral,
  formatIntegerLike,
  resolveRemappedBundleTarget,
  remapNumericBranchTargets,
  canPlacementMove,
  maxPreviousBundleOnSamePe,
  canMovePlacementToBundle,
  normalizeWindow
};
