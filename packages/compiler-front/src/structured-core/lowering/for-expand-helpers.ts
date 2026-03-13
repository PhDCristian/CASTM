export { instantiateEntriesWithBindings } from './for-expand-helpers/bindings.js';
export { enumerateForValues } from './for-expand-helpers/enumerate.js';
export {
  buildRuntimeNoUnrollAggressivePlan,
  buildRuntimeNoUnrollExitBranch,
  chooseJumpColumn
} from './for-expand-helpers/runtime-plan.js';
export type { RuntimeNoUnrollAggressivePlan } from './for-expand-helpers/runtime-plan.js';
