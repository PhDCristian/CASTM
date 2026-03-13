export {
  cloneCycle,
  cycleHasControlFlow,
  makeCallCycle,
  makeControlCycle
} from './function-expand-helpers/cycle.js';
export {
  buildWhileFusionPlan,
  rewriteConditionForWhileFusion
} from './function-expand-helpers/while-fusion.js';
export { instantiateFunctionBody } from './function-expand-helpers/function-instantiation.js';
