export {
  cloneBundle,
  bundleHasControlFlow,
  makeCallBundle,
  makeControlBundle
} from './function-expand-helpers/bundle.js';
export {
  buildWhileFusionPlan,
  rewriteConditionForWhileFusion
} from './function-expand-helpers/while-fusion.js';
export { instantiateFunctionBody } from './function-expand-helpers/function-instantiation.js';
