import { defineConfig } from 'vitest/config';
import path from 'path';

const SIMULATOR_ROOT = path.resolve(__dirname, '../UMA-CGRA-Simulator/src');

export default defineConfig({
  resolve: {
    alias: {
      // DSL compiler alias (for legacy test imports)
      '@utils/dsl-compiler': path.resolve(__dirname, 'src/compiler.ts'),

      // Simulator aliases — map the simulator's tsconfig paths so its
      // internal imports resolve when we import from the simulation engine.
      '@core/simulation': path.join(SIMULATOR_ROOT, 'core/simulation'),
      '@core': path.join(SIMULATOR_ROOT, 'core'),
      '@contexts/GridContext': path.join(SIMULATOR_ROOT, 'contexts/GridContext.tsx'),
      '@contexts': path.join(SIMULATOR_ROOT, 'contexts'),
      '@stores': path.join(SIMULATOR_ROOT, 'stores'),
      '@utils': path.join(SIMULATOR_ROOT, 'utils'),

      // Convenience alias for simulator API
      '@simulator': path.join(SIMULATOR_ROOT, 'api/index.ts'),
    },
  },
  test: {
    include: ['src/__tests__/**/*.test.ts'],
  },
});
