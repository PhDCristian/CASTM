import { defineConfig } from 'vitest/config';
import path from 'node:path';

const root = path.resolve(__dirname);

export default defineConfig({
  resolve: {
    alias: {
      '@castm/lang-spec': path.join(root, 'packages/lang-spec/src/index.ts'),
      '@castm/compiler-ir': path.join(root, 'packages/compiler-ir/src/index.ts'),
      '@castm/compiler-front': path.join(root, 'packages/compiler-front/src/index.ts'),
      '@castm/compiler-backend-csv': path.join(root, 'packages/compiler-backend-csv/src/index.ts'),
      '@castm/compiler-api': path.join(root, 'packages/compiler-api/src/index.ts'),
      '@castm/lsp-server': path.join(root, 'packages/lsp-server/src/index.ts'),
      '@castm/testkit': path.join(root, 'packages/testkit/src/index.ts')
    }
  },
  test: {
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: [
        'packages/compiler-api/src/**/*.ts',
        'packages/compiler-front/src/**/*.ts',
        'packages/compiler-ir/src/**/*.ts'
      ],
      thresholds: {
        lines: 100,
        statements: 100,
        functions: 100,
        branches: 100
      }
    }
  }
});
