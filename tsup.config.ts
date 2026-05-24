import { defineConfig } from 'tsup';

const emptyModule = {
  name: 'empty-optional-deps',
  setup(build: import('esbuild').PluginBuild) {
    build.onResolve({ filter: /^react-devtools-core$/ }, () => ({
      path: 'react-devtools-core',
      namespace: 'empty-module',
    }));
    build.onLoad({ filter: /.*/, namespace: 'empty-module' }, () => ({
      contents: 'export default null;',
    }));
  },
};

export default defineConfig({
  entry: ['src/cli.ts'],
  outDir: 'dist',
  format: ['esm'],
  outExtension: () => ({ js: '.mjs' }),
  target: 'node22',
  bundle: true,
  noExternal: [
    'react',
    'react/jsx-runtime',
    'scheduler',
    'ink',
    'ink-select-input',
    'ink-spinner',
    'ink-text-input',
  ],
  esbuildPlugins: [emptyModule],
  banner: {
    js: `import { createRequire } from 'module'; const require = createRequire(import.meta.url);`,
  },
  sourcemap: true,
  clean: true,
  esbuildOptions(options) {
    options.jsx = 'automatic';
    options.jsxImportSource = 'react';
  },
});
