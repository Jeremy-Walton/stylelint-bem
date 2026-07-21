import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/configs/recommended.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
});
