import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/cli.ts', 'src/Orchestrator.ts', 'src/Agent.ts', 'src/types.ts'],
  format: ['esm'],
  dts: false,
  splitting: false,
  sourcemap: true,
  clean: true,
  minify: false,
  bundle: false,
  treeshake: true,
  external: [],
  target: 'node18',
  platform: 'node',
});