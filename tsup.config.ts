import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/extension.ts'],
  format: ['cjs'],
  target: 'es2022',
  platform: 'node',
  external: ['vscode'],
  noExternal: ['reactive-vscode'],
  clean: true,
  minify: false,
  sourcemap: true,
  splitting: false,
  dts: false,
})
