import { defineConfig } from 'vitest/config';
import path from 'node:path';

const root = path.resolve(__dirname);

export default defineConfig({
  resolve: {
    alias: {
      '@openedge/lang-spec': path.join(root, 'packages/lang-spec/src/index.ts'),
      '@openedge/compiler-ir': path.join(root, 'packages/compiler-ir/src/index.ts'),
      '@openedge/compiler-front': path.join(root, 'packages/compiler-front/src/index.ts'),
      '@openedge/compiler-backend-csv': path.join(root, 'packages/compiler-backend-csv/src/index.ts'),
      '@openedge/compiler-api': path.join(root, 'packages/compiler-api/src/index.ts'),
      '@openedge/lsp-server': path.join(root, 'packages/lsp-server/src/index.ts'),
      '@openedge/testkit': path.join(root, 'packages/testkit/src/index.ts')
    }
  },
  test: {
    include: ['tests/**/*.test.ts']
  }
});
