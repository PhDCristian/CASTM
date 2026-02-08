import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@utils/dsl-compiler': path.resolve(__dirname, 'src/compiler.ts'),
    },
  },
  test: {
    include: ['src/__tests__/**/*.test.ts'],
    exclude: ['src/__tests__/simulation/**'],
  },
});
